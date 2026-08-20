/**
 * Contrato común de los conectores de tienda (Fase 2 del brief).
 *
 * Todo es de **sólo lectura**. Ningún conector expone métodos para cambiar
 * inventario, cancelar pedidos o emitir reembolsos: esas acciones son Fase 3 y
 * requieren aprobación humana explícita. Si el método no existe, el agente no
 * puede llamarlo por mucho que se lo pidan.
 */

export type ProductoTienda = {
  sku: string;
  nombre: string;
  descripcion?: string;
  precioCentavos: number;
  moneda: string;
  stock: number;
};

export type EstadoPedido =
  | "pendiente"
  | "pagado"
  | "preparando"
  | "enviado"
  | "entregado"
  | "cancelado"
  | "desconocido";

export type PedidoTienda = {
  numero: string;
  estado: EstadoPedido;
  /** Texto tal cual lo devuelve la plataforma, para el panel y la auditoría. */
  estadoCrudo: string;
  rastreo?: string;
  urlRastreo?: string;
  totalCentavos: number;
  moneda: string;
  fecha: string;
  items: { nombre: string; cantidad: number }[];
};

export interface ConectorTienda {
  readonly nombre: string;

  /** Catálogo completo, para sincronizar contra la base local. */
  listarProductos(limite?: number): Promise<ProductoTienda[]>;

  /**
   * Un pedido por su número. El teléfono se usa para comprobar que quien
   * pregunta es el dueño del pedido: sin esa comprobación, cualquiera con un
   * número de pedido leería datos de otro cliente.
   */
  buscarPedido(numero: string, telefono: string): Promise<PedidoTienda | null>;
}

export class ErrorTienda extends Error {
  constructor(
    message: string,
    readonly estado?: number,
  ) {
    super(message);
    this.name = "ErrorTienda";
  }
}

/** Normaliza el vocabulario de cada plataforma a un estado único. */
export function normalizarEstado(crudo: string): EstadoPedido {
  const v = crudo.toLowerCase();
  if (/cancel|refund|void/.test(v)) return "cancelado";
  if (/deliver|entregad|complet/.test(v)) return "entregado";
  if (/ship|fulfil|envi|transit/.test(v)) return "enviado";
  if (/pack|prepar|process|procesand/.test(v)) return "preparando";
  if (/paid|pagad|approved/.test(v)) return "pagado";
  if (/pend|unpaid|hold|await/.test(v)) return "pendiente";
  return "desconocido";
}

/** Sólo los últimos dígitos deben coincidir: el formato del teléfono varía. */
export function telefonoCoincide(a: string | undefined | null, b: string): boolean {
  if (!a) return false;
  const soloDigitos = (s: string) => s.replace(/\D/g, "");
  const x = soloDigitos(a);
  const y = soloDigitos(b);
  if (x.length < 8 || y.length < 8) return false;
  return x.slice(-8) === y.slice(-8);
}
