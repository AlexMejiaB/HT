import {
  type ConectorTienda,
  type ProductoTienda,
  type PedidoTienda,
  ErrorTienda,
  normalizarEstado,
  telefonoCoincide,
} from "@/lib/tienda/tipos";

/**
 * Tiendanube / Nuvemshop API v1.
 *
 * El "dominio" que se guarda aquí es el id numérico de la tienda, no una URL:
 * la API se direcciona por id. Autentica con `Authentication: bearer <token>`
 * y exige un User-Agent identificable.
 */
export class ConectorTiendanube implements ConectorTienda {
  readonly nombre = "Tiendanube";

  constructor(
    private storeId: string,
    private token: string,
  ) {}

  private async pedir<T>(ruta: string): Promise<T> {
    const r = await fetch(`https://api.tiendanube.com/v1/${this.storeId}/${ruta}`, {
      headers: {
        authentication: `bearer ${this.token}`,
        "user-agent": "Veloce AI (soporte@veloce.ai)",
        accept: "application/json",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) {
      throw new ErrorTienda(`Tiendanube respondió ${r.status}`, r.status);
    }
    return (await r.json()) as T;
  }

  /** Los textos vienen como objeto de idiomas: se toma español y si no, el primero. */
  private texto(v: unknown): string {
    if (typeof v === "string") return v;
    if (v && typeof v === "object") {
      const o = v as Record<string, string>;
      return o.es ?? o.es_MX ?? Object.values(o)[0] ?? "";
    }
    return "";
  }

  async listarProductos(limite = 200): Promise<ProductoTienda[]> {
    const datos = await this.pedir<
      {
        name?: unknown;
        description?: unknown;
        variants?: {
          sku?: string | null;
          price?: string;
          stock?: number | null;
        }[];
      }[]
    >(`products?per_page=${Math.min(limite, 200)}`);

    const salida: ProductoTienda[] = [];
    for (const p of datos) {
      for (const v of p.variants ?? []) {
        if (!v.sku) continue;
        salida.push({
          sku: v.sku,
          nombre: this.texto(p.name) || v.sku,
          descripcion: this.texto(p.description).replace(/<[^>]*>/g, "").slice(0, 500),
          precioCentavos: Math.round(Number(v.price ?? 0) * 100),
          moneda: "MXN",
          // stock null significa "sin control de inventario", no "agotado".
          stock: v.stock ?? 1,
        });
      }
    }
    return salida;
  }

  async buscarPedido(numero: string, telefono: string): Promise<PedidoTienda | null> {
    const limpio = numero.replace(/^#/, "");
    const datos = await this.pedir<
      {
        number?: number;
        status?: string;
        shipping_status?: string;
        payment_status?: string;
        total?: string;
        currency?: string;
        created_at?: string;
        shipping_tracking_number?: string | null;
        shipping_tracking_url?: string | null;
        customer?: { phone?: string | null };
        products?: { name?: unknown; quantity?: number }[];
      }[]
    >(`orders?q=${encodeURIComponent(limpio)}&per_page=5`);

    const pedido = datos.find((o) => String(o.number) === limpio) ?? datos[0];
    if (!pedido) return null;

    if (!telefonoCoincide(pedido.customer?.phone, telefono)) return null;

    const estadoCrudo =
      pedido.shipping_status ?? pedido.payment_status ?? pedido.status ?? "desconocido";

    return {
      numero: String(pedido.number ?? limpio),
      estado: normalizarEstado(estadoCrudo),
      estadoCrudo,
      rastreo: pedido.shipping_tracking_number ?? undefined,
      urlRastreo: pedido.shipping_tracking_url ?? undefined,
      totalCentavos: Math.round(Number(pedido.total ?? 0) * 100),
      moneda: pedido.currency ?? "MXN",
      fecha: pedido.created_at ?? "",
      items: (pedido.products ?? []).map((i) => ({
        nombre: this.texto(i.name),
        cantidad: i.quantity ?? 1,
      })),
    };
  }
}
