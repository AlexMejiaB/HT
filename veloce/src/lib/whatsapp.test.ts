import { describe, it, expect } from "vitest";
import { extraerMensajes, extraerMensajesInstagram } from "@/lib/whatsapp";

const sobre = (value: unknown) => ({ entry: [{ changes: [{ value }] }] });

describe("extraerMensajes", () => {
  it("extrae un mensaje de texto con su phone_number_id y perfil", () => {
    const r = extraerMensajes(
      sobre({
        metadata: { phone_number_id: "PNID_1" },
        contacts: [{ profile: { name: "Ana" }, wa_id: "521551234" }],
        messages: [
          { id: "wamid.1", from: "521551234", type: "text", text: { body: "hola" } },
        ],
      }),
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      phoneNumberId: "PNID_1",
      waMessageId: "wamid.1",
      de: "521551234",
      nombrePerfil: "Ana",
      texto: "hola",
    });
  });

  it("captura la campaña de Meta cuando el mensaje viene de un anuncio", () => {
    const r = extraerMensajes(
      sobre({
        metadata: { phone_number_id: "PNID_1" },
        messages: [
          {
            id: "wamid.2",
            from: "5215",
            type: "text",
            text: { body: "info" },
            referral: { source_id: "CAMPANA_42" },
          },
        ],
      }),
    );
    expect(r[0].origenCampana).toBe("CAMPANA_42");
  });

  it("ignora estados de entrega y tipos que no son texto", () => {
    expect(
      extraerMensajes(
        sobre({
          metadata: { phone_number_id: "PNID_1" },
          statuses: [{ id: "wamid.1", status: "delivered" }],
        }),
      ),
    ).toHaveLength(0);

    expect(
      extraerMensajes(
        sobre({
          metadata: { phone_number_id: "PNID_1" },
          messages: [{ id: "wamid.3", from: "5215", type: "image" }],
        }),
      ),
    ).toHaveLength(0);
  });

  it("no revienta con payloads incompletos o desconocidos", () => {
    expect(extraerMensajes({})).toEqual([]);
    expect(extraerMensajes(null)).toEqual([]);
    expect(extraerMensajes(sobre({ messages: [] }))).toEqual([]);
    // Sin phone_number_id no se puede enrutar a un tenant: se descarta.
    expect(
      extraerMensajes(
        sobre({ messages: [{ id: "x", from: "y", type: "text", text: { body: "z" } }] }),
      ),
    ).toEqual([]);
  });

  it("extrae varios mensajes de un mismo lote", () => {
    const r = extraerMensajes(
      sobre({
        metadata: { phone_number_id: "PNID_1" },
        messages: [
          { id: "a", from: "1", type: "text", text: { body: "uno" } },
          { id: "b", from: "2", type: "text", text: { body: "dos" } },
        ],
      }),
    );
    expect(r.map((m) => m.texto)).toEqual(["uno", "dos"]);
  });
});

describe("extraerMensajesInstagram", () => {
  const sobreIg = (messaging: unknown[]) => ({
    object: "instagram",
    entry: [{ id: "IG_CUENTA", messaging }],
  });

  it("extrae un mensaje de Instagram y lo marca con su canal", () => {
    const r = extraerMensajesInstagram(
      sobreIg([
        { sender: { id: "IGSID_1" }, message: { mid: "mid.1", text: "hola" } },
      ]),
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      phoneNumberId: "IG_CUENTA",
      waMessageId: "mid.1",
      de: "IGSID_1",
      texto: "hola",
      canal: "INSTAGRAM",
    });
  });

  it("ignora los echo para no responderse a sí mismo", () => {
    // Sin este filtro el agente contesta a su propio mensaje en bucle.
    const r = extraerMensajesInstagram(
      sobreIg([
        { sender: { id: "IG_CUENTA" }, message: { mid: "mid.2", text: "eco", is_echo: true } },
      ]),
    );
    expect(r).toHaveLength(0);
  });

  it("no procesa payloads de otro objeto", () => {
    expect(extraerMensajesInstagram({ object: "whatsapp_business_account", entry: [] })).toEqual([]);
    expect(extraerMensajesInstagram(null)).toEqual([]);
    expect(extraerMensajesInstagram({})).toEqual([]);
  });

  it("captura el referral de un anuncio", () => {
    const r = extraerMensajesInstagram(
      sobreIg([
        {
          sender: { id: "IGSID_2" },
          message: { mid: "mid.3", text: "info" },
          referral: { ref: "CAMPANA_IG" },
        },
      ]),
    );
    expect(r[0].origenCampana).toBe("CAMPANA_IG");
  });

  it("el extractor general también recoge Instagram", () => {
    const r = extraerMensajes(sobreIg([
      { sender: { id: "IGSID_3" }, message: { mid: "mid.4", text: "hey" } },
    ]));
    expect(r).toHaveLength(1);
    expect(r[0].canal).toBe("INSTAGRAM");
  });
});
