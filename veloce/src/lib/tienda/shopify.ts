import {
  type ConectorTienda,
  type ProductoTienda,
  type PedidoTienda,
  ErrorTienda,
  normalizarEstado,
  telefonoCoincide,
} from "@/lib/tienda/tipos";

const VERSION = "2025-07";

/**
 * Shopify Admin API con token de app privada.
 * Requiere los scopes de lectura `read_products` y `read_orders`.
 */
export class ConectorShopify implements ConectorTienda {
  readonly nombre = "Shopify";

  constructor(
    private dominio: string,
    private token: string,
  ) {}

  private async pedir<T>(ruta: string): Promise<T> {
    const r = await fetch(`https://${this.dominio}/admin/api/${VERSION}/${ruta}`, {
      headers: { "X-Shopify-Access-Token": this.token, accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) {
      throw new ErrorTienda(`Shopify respondió ${r.status}`, r.status);
    }
    return (await r.json()) as T;
  }

  async listarProductos(limite = 250): Promise<ProductoTienda[]> {
    const datos = await this.pedir<{
      products?: {
        title?: string;
        body_html?: string;
        variants?: {
          sku?: string;
          title?: string;
          price?: string;
          inventory_quantity?: number;
        }[];
      }[];
    }>(`products.json?limit=${Math.min(limite, 250)}`);

    const salida: ProductoTienda[] = [];
    for (const p of datos.products ?? []) {
      for (const v of p.variants ?? []) {
        if (!v.sku) continue; // sin SKU no se puede casar con el catálogo local
        salida.push({
          sku: v.sku,
          nombre: v.title && v.title !== "Default Title" ? `${p.title} · ${v.title}` : (p.title ?? v.sku),
          descripcion: p.body_html?.replace(/<[^>]*>/g, "").slice(0, 500),
          precioCentavos: Math.round(Number(v.price ?? 0) * 100),
          moneda: "MXN",
          stock: v.inventory_quantity ?? 0,
        });
      }
    }
    return salida;
  }

  async buscarPedido(numero: string, telefono: string): Promise<PedidoTienda | null> {
    const limpio = numero.replace(/^#/, "");
    const datos = await this.pedir<{
      orders?: {
        name?: string;
        financial_status?: string;
        fulfillment_status?: string | null;
        total_price?: string;
        currency?: string;
        created_at?: string;
        phone?: string | null;
        customer?: { phone?: string | null };
        shipping_address?: { phone?: string | null };
        line_items?: { title?: string; quantity?: number }[];
        fulfillments?: { tracking_number?: string | null; tracking_url?: string | null }[];
      }[];
    }>(`orders.json?name=${encodeURIComponent(limpio)}&status=any&limit=5`);

    const pedido = datos.orders?.[0];
    if (!pedido) return null;

    // Comprobación de titularidad antes de devolver nada.
    const telefonos = [
      pedido.phone,
      pedido.customer?.phone,
      pedido.shipping_address?.phone,
    ];
    if (!telefonos.some((t) => telefonoCoincide(t, telefono))) return null;

    const envio = pedido.fulfillments?.[0];
    const estadoCrudo = pedido.fulfillment_status ?? pedido.financial_status ?? "desconocido";

    return {
      numero: pedido.name ?? limpio,
      estado: normalizarEstado(estadoCrudo),
      estadoCrudo,
      rastreo: envio?.tracking_number ?? undefined,
      urlRastreo: envio?.tracking_url ?? undefined,
      totalCentavos: Math.round(Number(pedido.total_price ?? 0) * 100),
      moneda: pedido.currency ?? "MXN",
      fecha: pedido.created_at ?? "",
      items: (pedido.line_items ?? []).map((i) => ({
        nombre: i.title ?? "",
        cantidad: i.quantity ?? 1,
      })),
    };
  }
}
