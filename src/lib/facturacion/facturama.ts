/**
 * Facturama: emisión de CFDI 4.0.
 *
 * Timbrar es un acto fiscal irreversible: genera un documento ante el SAT que
 * después hay que cancelar con su propio trámite. Por eso esta clase nunca se
 * llama directamente desde el agente — sólo desde una acción de nivel BLOQUEO,
 * después de que una persona la autorice.
 */

const BASE_PRODUCCION = "https://api.facturama.mx";
const BASE_SANDBOX = "https://apisandbox.facturama.mx";

export class ErrorFacturacion extends Error {
  constructor(
    message: string,
    readonly estado?: number,
  ) {
    super(message);
    this.name = "ErrorFacturacion";
  }
}

export type DatosReceptor = {
  /** RFC del receptor, como aparece en su constancia de situación fiscal. */
  rfc: string;
  /**
   * Razón social EXACTA del registro del SAT. En CFDI 4.0 una abreviatura o un
   * acento de más hace que el timbrado sea rechazado.
   */
  nombre: string;
  /** Código postal del domicilio fiscal registrado, no el de envío. */
  codigoPostal: string;
  /** Obligatorio en 4.0. */
  regimenFiscal: string;
  usoCfdi: string;
  email?: string;
};

export type ConceptoFactura = {
  claveProdServ: string;
  claveUnidad: string;
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
};

export type FacturaEmitida = {
  id: string;
  folio: string;
  uuid: string;
  total: number;
};

export class ClienteFacturama {
  private base: string;

  constructor(
    private usuario: string,
    private secreto: string,
    sandbox = true,
  ) {
    this.base = sandbox ? BASE_SANDBOX : BASE_PRODUCCION;
  }

  private async pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
    const auth = Buffer.from(`${this.usuario}:${this.secreto}`).toString("base64");
    const r = await fetch(`${this.base}/${ruta}`, {
      ...init,
      headers: {
        authorization: `Basic ${auth}`,
        "content-type": "application/json",
        accept: "application/json",
        ...init?.headers,
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!r.ok) {
      const detalle = await r.text().catch(() => "");
      throw new ErrorFacturacion(
        `Facturama respondió ${r.status}: ${detalle.slice(0, 400)}`,
        r.status,
      );
    }
    return (await r.json()) as T;
  }

  /** Timbra un CFDI de ingreso. */
  async emitir(
    receptor: DatosReceptor,
    conceptos: ConceptoFactura[],
    formaPago: string,
    metodoPago: "PUE" | "PPD",
  ): Promise<FacturaEmitida> {
    const items = conceptos.map((c) => {
      const importe = Number((c.cantidad * c.valorUnitario).toFixed(2));
      // IVA 16% trasladado: el caso general en México.
      const iva = Number((importe * 0.16).toFixed(2));
      return {
        ProductCode: c.claveProdServ,
        UnitCode: c.claveUnidad,
        Description: c.descripcion,
        Quantity: c.cantidad,
        UnitPrice: c.valorUnitario,
        Subtotal: importe,
        Total: Number((importe + iva).toFixed(2)),
        TaxObject: "02",
        Taxes: [
          {
            Name: "IVA",
            Rate: 0.16,
            Total: iva,
            Base: importe,
            IsRetention: false,
          },
        ],
      };
    });

    const r = await this.pedir<{
      Id?: string;
      Folio?: string;
      Complement?: { TaxStamp?: { Uuid?: string } };
      Total?: number;
    }>("cfdis", {
      method: "POST",
      body: JSON.stringify({
        NameId: "1",
        CfdiType: "I",
        PaymentForm: formaPago,
        PaymentMethod: metodoPago,
        ExpeditionPlace: receptor.codigoPostal,
        Receiver: {
          Rfc: receptor.rfc.toUpperCase(),
          Name: receptor.nombre,
          CfdiUse: receptor.usoCfdi,
          FiscalRegime: receptor.regimenFiscal,
          TaxZipCode: receptor.codigoPostal,
          ...(receptor.email ? { Email: receptor.email } : {}),
        },
        Items: items,
      }),
    });

    const uuid = r.Complement?.TaxStamp?.Uuid;
    if (!r.Id || !uuid) {
      throw new ErrorFacturacion("Facturama no devolvió UUID: el timbrado no se completó");
    }

    return {
      id: r.Id,
      folio: r.Folio ?? "",
      uuid,
      total: r.Total ?? 0,
    };
  }

  /**
   * Cancela un CFDI.
   *
   * El motivo 01 exige el UUID del comprobante que lo sustituye, así que el
   * reemplazo debe timbrarse antes. La cancelación puede quedar pendiente de
   * aceptación del receptor: no siempre es inmediata.
   */
  async cancelar(
    id: string,
    motivo: "01" | "02" | "03" | "04",
    uuidReemplazo?: string,
  ): Promise<{ estado: string }> {
    if (motivo === "01" && !uuidReemplazo) {
      throw new ErrorFacturacion(
        "El motivo 01 requiere el UUID del CFDI que sustituye al cancelado",
      );
    }
    const ruta =
      `cfdi/${id}/issued/${motivo}` + (uuidReemplazo ? `/${uuidReemplazo}` : "");
    const r = await this.pedir<{ Status?: string }>(ruta, { method: "DELETE" });
    return { estado: r.Status ?? "solicitada" };
  }
}
