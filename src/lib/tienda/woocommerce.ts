import {
  type ConectorTienda,
  type ProductoTienda,
  type PedidoTienda,
  ErrorTienda,
  normalizarEstado,
  telefonoCoincide,
} from "@/lib/tienda/tipos";

/**
 * WooCommerce REST API v3. Autentica con consumer key y secret por Basic auth,
 * que WooCommerce sólo acepta sobre HTTPS.
 */
export class ConectorWooCommerce implements ConectorTienda {
  readonly nombre = "WooCommerce";

  constructor(
    private dominio: string,
    private consumerKey: string,
    private consumerSecret: string,
  ) {}

  private async pedir<T>(ruta: string): Promise<T> {
    const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString("base64");
    const r = await fetch(`https://${this.dominio}/wp-json/wc/v3/${ruta}`, {
      headers: { authorization: `Basic ${auth}`, accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) {
      throw new ErrorTienda(`WooCommerce respondió ${r.status}`, r.status);
    }
    return (await r.json()) as T;
  }

  async listarProductos(limite = 100): Promise<ProductoTienda[]> {
    const datos = await this.pedir<
      {
        sku?: string;
        name?: string;
        short_description?: string;
        price?: string;
        stock_quantity?: number | null;
        stock_status?: string;
      }[]
    >(`products?per_page=${Math.min(limite, 100)}&status=publish`);

    return datos
      .filter((p) => p.sku)
      .map((p) => ({
        sku: p.sku!,
        nombre: p.name ?? p.sku!,
        descripcion: p.short_description?.replace(/<[^>]*>/g, "").slice(0, 500),
        precioCentavos: Math.round(Number(p.price ?? 0) * 100),
        moneda: "MXN",
        // Con la gestión de stock desactivada, Woo devuelve null: se infiere
        // del estado para no reportar "agotado" cuando sí hay disponibilidad.
        stock: p.stock_quantity ?? (p.stock_status === "instock" ? 1 : 0),
      }));
  }

  async buscarPedido(numero: string, telefono: string): Promise<PedidoTienda | null> {
    const limpio = numero.replace(/^#/, "");
    if (!/^\d+$/.test(limpio)) return null; // Woo indexa por id numérico

    let pedido: {
      number?: string;
      status?: string;
      total?: string;
      currency?: string;
      date_created?: string;
      billing?: { phone?: string };
      shipping?: { phone?: string };
      line_items?: { name?: string; quantity?: number }[];
    } | null = null;

    try {
      pedido = await this.pedir(`orders/${limpio}`);
    } catch (e) {
      if (e instanceof ErrorTienda && e.estado === 404) return null;
      throw e;
    }
    if (!pedido) return null;

    const telefonos = [pedido.billing?.phone, pedido.shipping?.phone];
    if (!telefonos.some((t) => telefonoCoincide(t, telefono))) return null;

    const estadoCrudo = pedido.status ?? "desconocido";
    return {
      numero: pedido.number ?? limpio,
      estado: normalizarEstado(estadoCrudo),
      estadoCrudo,
      totalCentavos: Math.round(Number(pedido.total ?? 0) * 100),
      moneda: pedido.currency ?? "MXN",
      fecha: pedido.date_created ?? "",
      items: (pedido.line_items ?? []).map((i) => ({
        nombre: i.name ?? "",
        cantidad: i.quantity ?? 1,
      })),
    };
  }
}
