import { z } from "zod";
import { db } from "@/lib/db";
import { descifrar } from "@/lib/cifrado";
import { registrarAccion } from "@/lib/aprobaciones/registro";
import { ClienteFacturama } from "@/lib/facturacion/facturama";
import { enviarTexto } from "@/lib/whatsapp";

/**
 * Catálogo de acciones operativas y su nivel de riesgo.
 *
 * Este archivo es la frontera entre lo que el agente hace solo y lo que exige
 * una persona. El nivel vive aquí, en código, no en el prompt: un prompt se
 * deja convencer de que emitir una factura es rutina.
 *
 * Proporción sana: la mayoría AUTOMATICO, unas pocas REVISION, muy pocas
 * BLOQUEO. Si casi todo bloquea, el alcance del agente está mal planteado.
 */

// ------------------------------------------------------------- AUTOMATICO

/** Nota interna en la conversación. Reversible y no sale del sistema. */
registrarAccion({
  accion: "anotar_conversacion",
  nivel: "AUTOMATICO",
  titulo: "Anotar en la conversación",
  esquema: z.object({
    conversacionId: z.string().min(1),
    nota: z.string().min(1).max(1000),
  }),
  describir: (a) => `Nota interna: ${a.nota.slice(0, 120)}`,
  ejecutar: async (tenantId, a) => {
    const r = await db.conversacion.updateMany({
      where: { id: a.conversacionId, tenantId },
      data: { resumen: a.nota },
    });
    return { actualizadas: r.count };
  },
});

/** Etiquetar. Reversible de un clic. */
registrarAccion({
  accion: "etiquetar_conversacion",
  nivel: "AUTOMATICO",
  titulo: "Etiquetar conversación",
  esquema: z.object({
    conversacionId: z.string().min(1),
    etiquetas: z.array(z.string().min(1).max(40)).min(1).max(8),
  }),
  describir: (a) => `Etiquetas: ${a.etiquetas.join(", ")}`,
  ejecutar: async (tenantId, a) => {
    const c = await db.conversacion.findFirst({
      where: { id: a.conversacionId, tenantId },
      select: { etiquetas: true },
    });
    if (!c) throw new Error("Conversación no encontrada");
    const etiquetas = [...new Set([...c.etiquetas, ...a.etiquetas])];
    await db.conversacion.updateMany({
      where: { id: a.conversacionId, tenantId },
      data: { etiquetas },
    });
    return { etiquetas };
  },
});

// --------------------------------------------------------------- REVISION

/**
 * Mensaje proactivo al cliente. El agente acierta casi siempre, pero el 5% que
 * falla lo ve el cliente y no se puede deshacer: por eso pasa por revisión.
 *
 * Al vencer el plazo escala a una persona; nunca se envía solo.
 */
registrarAccion({
  accion: "enviar_mensaje_proactivo",
  nivel: "REVISION",
  plazoMinutos: 30,
  titulo: "Mensaje proactivo al cliente",
  esquema: z.object({
    telefono: z.string().min(10).max(20),
    texto: z.string().min(1).max(900),
    motivo: z.string().min(1).max(200),
  }),
  describir: (a) => `A ${a.telefono} · ${a.motivo}\n\n"${a.texto}"`,
  ejecutar: async (tenantId, a) => {
    const t = await db.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { waPhoneNumberId: true, waTokenCifrado: true },
    });
    if (!t.waPhoneNumberId || !t.waTokenCifrado) {
      throw new Error("El negocio no tiene WhatsApp conectado");
    }
    const envio = await enviarTexto(t.waPhoneNumberId, t.waTokenCifrado, a.telefono, a.texto);
    if (!envio.ok) throw new Error(envio.error);
    return { mensajeId: envio.id };
  },
});

/** Ajuste manual de stock. Se revisa porque descuadrar inventario cuesta ventas. */
registrarAccion({
  accion: "ajustar_stock",
  nivel: "REVISION",
  plazoMinutos: 60,
  titulo: "Ajustar existencias",
  esquema: z.object({
    sku: z.string().min(1).max(60),
    stock: z.number().int().min(0),
    motivo: z.string().min(1).max(200),
  }),
  describir: (a) => `${a.sku} → ${a.stock} piezas. Motivo: ${a.motivo}`,
  ejecutar: async (tenantId, a) => {
    const r = await db.producto.updateMany({
      where: { tenantId, sku: a.sku },
      data: { stock: a.stock, fuente: "ajuste_manual" },
    });
    if (r.count === 0) throw new Error(`No existe el SKU ${a.sku}`);
    return { sku: a.sku, stock: a.stock };
  },
});

// ---------------------------------------------------------------- BLOQUEO

/**
 * Emisión de CFDI. Irreversible en el sentido que importa: cancelar un timbrado
 * es otro trámite ante el SAT, no un "deshacer".
 *
 * Sin plazo de vencimiento a propósito. No se emite hasta que una persona lo
 * autoriza, por mucho que el cliente insista.
 */
registrarAccion({
  accion: "emitir_factura",
  nivel: "BLOQUEO",
  titulo: "Emitir factura (CFDI 4.0)",
  esquema: z.object({
    rfc: z
      .string()
      .min(12)
      .max(13)
      .regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i, "RFC con formato inválido"),
    razonSocial: z.string().min(1).max(300),
    codigoPostal: z.string().regex(/^\d{5}$/, "Código postal de 5 dígitos"),
    regimenFiscal: z.string().min(3).max(4),
    usoCfdi: z.string().min(1).max(4),
    email: z.email().optional(),
    conceptos: z
      .array(
        z.object({
          claveProdServ: z.string().min(8).max(8),
          claveUnidad: z.string().min(1).max(4),
          descripcion: z.string().min(1).max(300),
          cantidad: z.number().positive(),
          valorUnitario: z.number().nonnegative(),
        }),
      )
      .min(1),
    formaPago: z.string().min(2).max(2),
    metodoPago: z.enum(["PUE", "PPD"]),
  }),
  describir: (a) => {
    const total = a.conceptos.reduce((s, c) => s + c.cantidad * c.valorUnitario, 0);
    return [
      `RFC ${a.rfc.toUpperCase()} · ${a.razonSocial}`,
      `CP ${a.codigoPostal} · Régimen ${a.regimenFiscal} · Uso ${a.usoCfdi}`,
      `${a.conceptos.length} concepto(s), subtotal $${total.toFixed(2)} MXN + IVA`,
      "",
      "Verifica que la razón social coincida EXACTO con la constancia fiscal:",
      "en CFDI 4.0 una abreviatura o un acento de más hace que el SAT rechace.",
    ].join("\n");
  },
  ejecutar: async (tenantId, a) => {
    const t = await db.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        facturaUsuario: true,
        facturaSecretoCifrado: true,
        facturaSandbox: true,
      },
    });
    if (!t.facturaUsuario || !t.facturaSecretoCifrado) {
      throw new Error("El negocio no tiene configurado el proveedor de facturación");
    }

    const cliente = new ClienteFacturama(
      t.facturaUsuario,
      descifrar(t.facturaSecretoCifrado),
      t.facturaSandbox,
    );

    const factura = await cliente.emitir(
      {
        rfc: a.rfc,
        nombre: a.razonSocial,
        codigoPostal: a.codigoPostal,
        regimenFiscal: a.regimenFiscal,
        usoCfdi: a.usoCfdi,
        email: a.email,
      },
      a.conceptos,
      a.formaPago,
      a.metodoPago,
    );

    return { ...factura, sandbox: t.facturaSandbox };
  },
});
