# Estado del proyecto

Instantánea de dónde va Highticket, para retomarlo sin contexto previo — por
ejemplo al migrarlo a otro VPS. Si algo aquí contradice al código, gana el
código: actualiza este archivo.

**Última actualización:** agosto 2026

---

## Qué es

SaaS multi-tenant que pone un agente de IA a atender el WhatsApp de tiendas en
línea mexicanas. El agente responde dudas de catálogo, precios, existencias y
envíos leyendo **datos reales del negocio**, captura prospectos, y entrega a una
persona todo lo que no le corresponde resolver.

`veloce-ai` es el proyecto hermano. **Sólo Highticket es el SaaS**; Veloce queda
como landing de presentación.

---

## Lo que funciona hoy

| Área | Estado |
|---|---|
| Landing comercial | Completa, con la identidad del logotipo |
| Multi-tenant | Aislamiento verificado: un negocio recibe 404 al pedir datos de otro |
| Webhook de WhatsApp e Instagram | Firma HMAC verificada, deduplicación probada |
| Motor del agente | 4 barreras de guardrails, en código |
| Conectores de tienda | Shopify, WooCommerce, Tiendanube — **sólo lectura** |
| Panel | Métricas, conversaciones, catálogo, FAQs, líneas, equipo, aprobaciones |
| Conectar WhatsApp | `/panel/canales`, con prueba de envío real |
| Aprobación humana | Tres niveles, con idempotencia y auditoría |
| Modelo | Gemini 3.7 Flash, verificado de punta a punta |
| Restricción por plan | `src/lib/planes.ts`, aplicándose en tienda y líneas |

`pnpm test` → **101 pruebas**, sin necesitar base de datos.

---

## Lo que falta

Sigue el plan por fases. Lo pendiente, en orden:

1. **Desplegar en el VPS** con `highticket.app` — ver `DESPLIEGUE.md`.
2. **Terminar la restricción por plan**: falta aplicarla al enrutado de
   Instagram en el webhook, a `/panel/aprobaciones`, y **sacar
   `limiteMensajesMes` del formulario del cliente** (hoy el dueño puede borrarse
   su propio tope de gasto desde `/panel/configuracion`).
3. **Autopilot de verdad**: guías de envío, control de inventario y compras a
   proveedores. Todo por el motor de aprobaciones.
4. **Registro autoservicio**: hoy sólo se dan de alta negocios desde `/admin`.
   Requiere infraestructura de correo, que **no existe** en el proyecto.
5. **Cobro con Mercado Pago** (suscripciones/preapproval).
6. **Embedded Signup de Meta**, para que cada cliente conecte su WhatsApp con un
   botón en vez de pegar credenciales a mano.

---

## Trampas que ya costaron tiempo

Cosas que parecen bugs y no lo son, o que rompen en silencio.

### Gemini gasta `max_tokens` pensando

Los modelos 3.x razonan antes de responder y **ese pensamiento consume el
presupuesto de tokens y se cobra**, aunque no aparezca en `completion_tokens`.
El fallo se ve como una respuesta truncada a media frase, o vacía, con
`finish_reason: "length"`.

Medido con `gemini-3.7-flash`: sin ajuste ~396 tokens de pensamiento,
`reasoning_effort: "low"` ~298, `"none"` ~242. **Ponerlo en `none` ahorra ~39%
pero no lo elimina.** La defensa real es `max_tokens` holgado (2000) — sólo se
paga lo que se genera.

Para detectarlo: si `total_tokens` supera `prompt_tokens + completion_tokens`,
la diferencia son tokens de razonamiento.

### La capa OpenAI de Gemini se desvía en dos puntos

1. **Envuelve el cuerpo en un array**: devuelve `[{...}]`, no `{...}`. Sin
   desenvolverlo, `choices` sale `undefined` y todo parece "respuesta vacía".
2. **Usa HTTP 400, no 401, para llave inválida** (`"Please pass a valid API
   key"`). Consecuencia: cualquier reintento automático ante un 400 duplica
   todas las peticiones cuando la llave está mal.

Ambas están cubiertas en `src/lib/agente/llm.ts` con pruebas que reproducen las
respuestas reales.

### `\b` no reconoce acentos en JavaScript

Un patrón que termina en vocal acentuada nunca casa: `"no me llegó"` no
disparaba el guardrail. Por eso `src/lib/agente/guardrails.ts` **normaliza** el
texto antes de evaluar y los patrones se escriben sin acentos.

### Regex globales conservan `lastIndex`

Un patrón con `/g` usado con `.test()` recuerda dónde se quedó: la segunda
llamada sobre el mismo texto devuelve `false`. Costó que una tarjeta de crédito
pasara sin detectar. Los patrones de detección van sin `/g`; sólo las copias
para reemplazar lo llevan.

### Luhn no basta para detectar tarjetas

Un teléfono de 13 dígitos puede pasar Luhn por casualidad. En WhatsApp la gente
escribe su número constantemente, así que se exige además longitud real de
tarjeta (15/16/19) y prefijo de emisor.

### Tailwind v4 cambió la sintaxis de tamaños

`text-[length:--text-display]` es de la v3 y **no genera ninguna regla** en la
v4: los titulares salían en tamaño por defecto sin ningún error. En v4 un token
`--text-*` genera la clase directamente: `text-display`.

### Prisma 7 necesita driver adapter

`new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`. Y el
cliente generado es TypeScript, así que un script suelto necesita `tsx`, no
`node`.

### Migraciones divergentes entre los dos proyectos

Veloce y Highticket tienen historiales de migración **distintos**. Copiar
`prisma/migrations/` de uno a otro mete una migración "inicial" ajena que choca
con `type "Plan" already exists` y deja un registro fallido bloqueando el
historial. Si pasa: borrar el directorio de esa migración y el renglón de
`_prisma_migrations`.

---

## Decisiones de diseño que no son negociables

**Los guardrails viven en código, no en el prompt.** Un prompt se deja
convencer; una condición no. Son cuatro barreras alrededor del modelo:

1. Antes del modelo: datos de tarjeta, petición de persona, dinero, facturas,
   guías, cancelaciones y quejas graves escalan sin gastar una llamada.
2. Por intención: `HUMANO`, `QUEJA` y `DEVOLUCION` nunca las resuelve el agente.
3. Por confianza: bajo el umbral del negocio, no se adivina.
4. Después del modelo: si el borrador promete un descuento o un reembolso, se
   descarta y el caso pasa a una persona.

**Los conectores de tienda no tienen métodos de escritura.** No es que estén
deshabilitados: no existen. El agente no puede cambiar inventario ni cancelar un
pedido por mucho que se lo pidan.

**El pago lo confirma el webhook, no el cliente.** Nada marca un pedido como
pagado porque alguien escriba "ya pagué".

**Cuando el servicio se degrada, el agente escala — no se calla.** Se aplica al
agotar el límite mensual y se aplicará al suspender por impago. Un cliente final
nunca debe quedarse sin respuesta por un problema entre nosotros y la tienda.

**Toda escritura con efecto externo lleva clave de idempotencia.** Los webhooks
se reintentan por diseño.

---

## Cosas conocidas que hay que arreglar antes de escalar

- **El rate limit vive en memoria del proceso** (`src/lib/rate-limit.ts`). Con
  más de una instancia el límite se multiplica. Mover a Redis.
- **Las sesiones no se revocan.** Suspender un negocio no expulsa sus sesiones
  vivas: `leerSesion()` no revalida `Tenant.activo`. Duran 8 horas.
- **El login busca el correo globalmente** (`findFirst`) mientras el schema
  define `@@unique([tenantId, email])`. Dos negocios con el mismo correo
  romperían el acceso.
- **El primer usuario `SOPORTE_VELOCE` sólo nace por SQL.** Ni `/admin` ni
  `invitarUsuario` pueden crear ese rol.

---

## Mapa del código

```
src/
  app/
    page.tsx                  landing
    entrar/                   login
    admin/                    consola multi-negocio (sólo soporte)
    panel/
      canales/                conectar WhatsApp e Instagram
      catalogo/  faqs/  lineas/  tienda/  configuracion/
      conversaciones/         lista e hilo completo
      aprobaciones/           cola de acciones que esperan a una persona
      equipo/                 accesos y contactos de escalamiento
    api/webhooks/whatsapp/    entrada de mensajes (WhatsApp e Instagram)
  lib/
    planes.ts                 QUÉ desbloquea cada plan
    permisos.ts               QUIÉN puede hacer qué dentro del negocio
    agente/
      motor.ts                orquestación de la respuesta
      guardrails.ts           los límites, en código
      conocimiento.ts         contexto general + subcontexto por línea
      llm.ts                  adaptador de modelo, intercambiable
      uso.ts                  medición y tope de gasto
    tienda/                   conectores de e-commerce, sólo lectura
    aprobaciones/             motor de aprobación humana
    whatsapp.ts  cifrado.ts  sesion.ts  db.ts
  proxy.ts                    puerta del panel (Next 16 renombró middleware)
```

Documentos hermanos: `README.md` (cómo funciona), `DESPLIEGUE.md` (cómo
montarlo).
