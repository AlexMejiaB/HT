# Veloce AI

Landing comercial + SaaS multi-tenant de agentes de IA para e-commerce.
Corresponde a las **Fases 1 y 2 (Veloce Responde y Operador)** del brief de producto.

`highticket` es el proyecto gemelo: misma oferta, marca e identidad propias,
código independiente.

## Stack

| Pieza | Versión | Nota |
|---|---|---|
| Next.js | 16.3.1 | Última estable. App Router, Turbopack, `proxy` (ya no `middleware`) |
| React | 19.2.8 | |
| Prisma | 7.9.1 | Generador `prisma-client` + driver adapter `@prisma/adapter-pg` |
| Tailwind | 4.x | Tokens de marca en `src/app/globals.css` |
| Node | ≥ 20.9 | Requisito de Next 16 |

## Puesta en marcha

```bash
pnpm install
cp .env.example .env      # y llena los valores reales
pnpm db:migrate           # crea las tablas
pnpm db:seed              # tienda piloto de prueba
pnpm dev
pnpm test                 # 29 pruebas, sin base de datos
```

En desarrollo la base corre en podman rootless, no en el Postgres del sistema:

```bash
podman run -d --name veloce-pg \
  -e POSTGRES_USER=veloce -e POSTGRES_PASSWORD=veloce -e POSTGRES_DB=veloce_ai \
  -p 5433:5432 docker.io/library/postgres:17-alpine
```

Generar los secretos:

```bash
node -e 'console.log("CLAVE_CIFRADO=" + require("crypto").randomBytes(32).toString("base64"))'
node -e 'console.log("SECRETO_SESION=" + require("crypto").randomBytes(48).toString("hex"))'
```

## Estructura

```
src/
  app/
    page.tsx                      landing comercial
    entrar/                       login del panel
    admin/                        consola multi-tenant (sólo soporte)
    panel/                        resumen y métricas
      aprobaciones/               cola de acciones que esperan a una persona
      equipo/                      accesos al panel y contactos de escalamiento
      conversaciones/             lista e hilo completo por conversación
      catalogo/                   productos + importación CSV
      lineas/                     líneas de marca, subcontexto y ejemplos
      faqs/                       preguntas frecuentes
      tienda/                     conexión a Shopify/Woo/Tiendanube
      configuracion/              tono, políticas, horarios, umbral
    api/webhooks/whatsapp/        webhook de WhatsApp Cloud API
  components/                     secciones de la landing
  lib/
    site.ts                       contenido comercial (precios, copy, paquetes)
    agente/
      motor.ts                    orquestación de la respuesta
      guardrails.ts               límites del agente, en código
      conocimiento.ts             recuperación y ensamblado de contexto
      uso.ts                      medición y tope de gasto mensual
      llm.ts                      adaptador de modelo, intercambiable
      pedidos.ts                  consulta de estatus contra la tienda
      notificar.ts                aviso al equipo al escalar
    tienda/                       conectores de e-commerce, sólo lectura
      tipos.ts                    contrato común
      shopify.ts  woocommerce.ts  tiendanube.ts
    aprobaciones/                 motor de aprobación humana
      registro.ts                 catálogo de acciones y su nivel de riesgo
      motor.ts                    solicitar, aprobar, rechazar, vencer
      acciones.ts                 qué hace el agente solo y qué no
      inventario.ts               alertas de stock bajo
    facturacion/facturama.ts      CFDI 4.0
    permisos.ts                   permisos por rol
    whatsapp.ts                   Cloud API + Instagram: envío y parseo
    db.ts  sesion.ts  cifrado.ts  rate-limit.ts  metricas.ts  env.ts
  proxy.ts                        puerta del panel (Next 16 renombró middleware)
prisma/schema.prisma              modelo multi-tenant
```

## Cómo se aplican los guardrails

Las restricciones del brief **no viven en el prompt**: se evalúan en código, en
cuatro barreras alrededor del modelo. Un prompt se puede convencer; una
condición no.

1. **Antes del modelo** — datos de tarjeta, petición de persona, dinero,
   facturas, guías, cancelaciones y quejas graves escalan sin gastar una llamada.
2. **Por intención** — `HUMANO`, `QUEJA` y `DEVOLUCION` nunca las resuelve el agente.
3. **Por confianza** — bajo el umbral del tenant (`umbralConfianza`, 0.7 por
   defecto) no se adivina: escala.
4. **Después del modelo** — si el borrador promete un descuento, un reembolso,
   una cancelación o una factura, se descarta y el caso pasa a una persona.

Además: los precios, el stock y las políticas sólo salen de
`lib/agente/conocimiento.ts`, es decir de la base del tenant. Si un dato no está
ahí, el agente no lo sabe y lo dice.

### Reglas transversales

- **Idempotencia** — toda escritura con efecto externo pasa por la tabla
  `ClaveIdempotencia` antes de ejecutarse, para que un reintento no la duplique.
  El webhook además deduplica por `waMessageId`, que es único.
- **El pago lo confirma el webhook, no el cliente** — el prompt del redactor lo
  prohíbe explícitamente y no hay ninguna ruta que marque un pago desde el chat.
- **Cero datos de tarjeta por chat** — se detectan, se redactan antes de
  persistir y el caso escala.

## Seguridad

- CSP sin `unsafe-eval`, HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`,
  `poweredByHeader` desactivado — `next.config.ts`.
- Webhook: firma `X-Hub-Signature-256` verificada en tiempo constante contra el
  cuerpo crudo. Sin firma válida, 401.
- Tokens de WhatsApp cifrados en reposo con AES-256-GCM, IV por registro.
- Sesión en cookie `httpOnly` + `sameSite=lax`, JWT HS256 firmado.
- Login con rate limit por IP+correo y comparación señuelo, para no revelar por
  tiempo de respuesta qué correos existen.
- Aislamiento por tenant: toda consulta filtra por `tenantId`.

> El rate limit es **en memoria, por proceso**. Con más de una instancia hay que
> moverlo a Redis o el límite efectivo se multiplica.

## Conectar WhatsApp

1. En Meta, apunta el webhook a `https://tu-dominio/api/webhooks/whatsapp` con el
   valor de `META_VERIFY_TOKEN`.
2. Guarda en el tenant `waPhoneNumberId` y el token cifrado (`lib/cifrado.ts`).
   El `phone_number_id` es lo que enruta cada mensaje a su negocio.
3. Suscribe el campo `messages`.

## Fase 2

- **Conectores de tienda** (Shopify, WooCommerce, Tiendanube) en **sólo lectura**.
  La interfaz no expone ningún método de escritura: no hay forma de que el
  agente cambie inventario o cancele un pedido, por mucho que se lo pidan.
- **Estatus de pedido** leído de la fuente real. Antes de devolver nada se
  comprueba que el teléfono del pedido coincide con el de quien pregunta; sin
  esa comprobación, adivinar un número de pedido expondría datos de otro cliente.
- **Etiquetado** operativo (venta, pedido, devolución, incidencia, humano),
  derivado de la intención en código para que el vocabulario sea estable.
- **Instagram** por el mismo webhook, enrutado por id de cuenta. Los mensajes
  `is_echo` se descartan: procesarlos haría que el agente se respondiera a sí mismo.
- **Aviso al equipo al escalar**, con idempotencia por escalamiento y persona.

> Fuera de la ventana de 24 h de WhatsApp, Meta sólo admite plantillas
> aprobadas. Si el equipo no ha escrito hace poco, el aviso falla y queda en
> auditoría; el caso sigue visible en el panel. Para avisos garantizados hay que
> registrar una plantilla de utilidad.

## Fase 3

### Aprobación humana por niveles

El nivel de cada acción vive en `lib/aprobaciones/acciones.ts`, en código. Un
prompt se deja convencer de que emitir una factura es rutina; una tabla no.

| Nivel | Qué entra | Comportamiento |
|---|---|---|
| `AUTOMATICO` | Reversible, interno | Se ejecuta al instante |
| `REVISION` | Lo que ve el cliente, ajustes de stock | Se encola; al vencer el plazo **escala** |
| `BLOQUEO` | Facturar y todo lo irreversible | **Sin plazo.** No ocurre hasta que una persona autoriza |

Que `REVISION` escale en vez de auto-aprobar es la diferencia entre una cola de
revisión y un temporizador que aprueba solo. `BLOQUEO` no tiene plazo a
propósito: un vencimiento sería una puerta trasera a la autorización.

Toda solicitud se persiste **antes** de ejecutar nada, con clave de
idempotencia derivada de la acción y sus argumentos. El ejecutor lee de la base;
nunca recibe la orden del modelo.

### Roles y accesos

| | Panel | Configurar | Equipo | Aprobar revisión | Aprobar bloqueo | Admin |
|---|---|---|---|---|---|---|
| Dueño | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Agente | ✓ | — | — | ✓ | — | — |
| Soporte | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Autorizar dinero es competencia del dueño, no de cualquiera con acceso al panel.
Las páginas **y** las server actions comprueban el permiso: proteger la página y
dejar la acción abierta es la forma más común de que un control de acceso no
sirva de nada.

`/admin` da de alta negocios con su primer dueño en una transacción — un tenant
sin usuario es una cuenta a la que nadie puede entrar.

### Facturación CFDI 4.0

Timbrar es `BLOQUEO` y arranca en sandbox. El contexto que ve quien aprueba
incluye el aviso de que la razón social debe coincidir **exacto** con la
constancia fiscal: en 4.0 una abreviatura de más hace que el SAT rechace.

### Alertas de inventario

Un aviso por SKU y día. Un sistema que repite "stock bajo" cada hora acaba
silenciado, y entonces no avisa de nada.

## Conectar el modelo

El agente habla contra cualquier API con forma de OpenAI. Cambiar de proveedor
son tres variables, no un refactor.

**Gemini directo** (por defecto, tiene nivel gratuito):

```bash
# Llave en https://aistudio.google.com/apikey
LLM_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai"
LLM_MODELO="gemini-3.7-flash"
LLM_API_KEY="AIza…"
```

**OpenRouter** (una llave para todos los modelos):

```bash
LLM_BASE_URL="https://openrouter.ai/api/v1"
LLM_MODELO="google/gemini-3.7-flash"   # o nousresearch/hermes-4-70b
LLM_API_KEY="sk-or-…"
```

Comprueba la conexión antes de mandar tráfico real:

```bash
pnpm llm:probar
```

Verifica cuatro cosas por separado, porque una llave válida no garantiza que el
proveedor sirva aquí: que autentique, que devuelva **JSON parseable** para el
clasificador, que redacte español citando sólo los datos verificados, y que los
guardrails sigan bloqueando (esos no dependen del modelo).

### Particularidades de Gemini

Su capa de compatibilidad se desvía de OpenAI en dos puntos que rompen un
cliente ingenuo, y ambos están cubiertos:

1. **Envuelve el cuerpo en un array** — devuelve `[{...}]` en vez de `{...}`.
   Sin desenvolverlo, `choices` sale `undefined` y todo parece "respuesta vacía".
2. **Usa 400, no 401, para una llave inválida** — el mensaje es
   `"Please pass a valid API key"`. Por eso el reintento sin `response_format`
   sólo ocurre si el error habla del formato: reintentar a ciegas duplicaría
   cada petición fallida.

Además, `response_format: json_object` no está garantizado en esa capa, así que
la extracción de JSON tolera bloques ```` ```json ```` y prosa alrededor. Si
fallara, el agente escalaría cada mensaje: correcto, pero inservible.

### Contexto por cliente

El contexto tiene dos niveles y se ensambla por mensaje:

| Nivel | Dónde se edita | Cuándo entra |
|---|---|---|
| General | `/panel/configuracion` | Siempre: tono, políticas, horarios, indicaciones propias |
| Por línea | `/panel/lineas` | Sólo si el cliente pregunta por un producto de esa línea |

Un negocio con varias marcas define una **línea** por cada una, con su contexto
propio (garantías, tallas, tono). Los productos se asignan por SKU, y el agente
carga el subcontexto de la línea del producto mencionado — no el de todo el
catálogo. Si ninguna coincide se usa la línea marcada por defecto, y si no hay,
sólo el contexto general.

Los **ejemplos de respuesta** enseñan estilo mejor que los adjetivos: pueden ser
globales o de una línea concreta.

Las **indicaciones propias** del negocio se suman al prompt pero **no pueden
saltarse los guardrails**: esos se evalúan en código, fuera del alcance del texto.

### Configuración del modelo por cliente

Modelo, creatividad y esfuerzo de razonamiento se pueden fijar por negocio; en
blanco heredan el valor global. También hay **tope mensual de mensajes**: al
alcanzarlo el agente entrega los casos a una persona en vez de seguir gastando —
dejar al cliente sin respuesta sería peor.

### Particularidad de los modelos que razonan

Gemini 3.x delibera antes de responder, y **ese pensamiento consume `max_tokens`
y se cobra**. Medido contra `gemini-3.7-flash`:

| Ajuste | Tokens de pensamiento |
|---|---|
| sin el parámetro | ~396 |
| `reasoning_effort: "low"` | ~298 |
| `reasoning_effort: "none"` | ~242 |

Ponerlo en `none` ahorra ~39% pero **no lo elimina**. Por eso `max_tokens` va
holgado: el modo de fallo es truncar la respuesta a media frase, y sólo se paga
lo que se genera. Con `max_tokens: 20` la respuesta llegaba vacía.

### Costo por mensaje

Cada mensaje del cliente son dos llamadas: clasificar y redactar.

Medido en dos conversaciones reales con `gemini-3.7-flash`: 846 tokens de
entrada y 313 de salida por mensaje, contando el razonamiento.

| Modelo | Por 1,000 mensajes |
|---|---|
| `gemini-2.5-flash-lite` | ~$0.21 USD |
| `gemini-3.7-flash` | ~$0.91 USD |

Contra una mensualidad de $2,990 MXN (~$150 USD), el costo del modelo es ruido.
El consumo del mes se ve en el resumen del panel.

## Pruebas

`pnpm test` corre 93 pruebas sin necesitar base de datos: los guardrails, el
parseo del webhook de Meta y el cifrado/firma. Escribirlas destapó cuatro fallos
reales que ya están corregidos y cubiertos:

1. **`lastIndex` en regex globales** — los patrones de tarjeta usaban el flag
   `g` con `.test()`, que conserva `lastIndex` entre llamadas. La segunda
   evaluación del mismo texto devolvía `false`: una tarjeta pasaba sin detectar.
2. **`\b` no reconoce acentos en JavaScript** — un patrón terminado en vocal
   acentuada nunca casaba, así que `"no me llegó"` no escalaba. Ahora el texto
   se normaliza antes de evaluar y los patrones se escriben sin acentos.
3. **Teléfonos confundidos con tarjetas** — Luhn por sí solo da falsos positivos
   y en WhatsApp el cliente escribe su número constantemente. Se exige además
   longitud de tarjeta real (15/16/19) y prefijo de emisor.
4. **`extraerMensajes(null)` reventaba** — `null` es JSON válido y Meta puede
   mandar cuerpos inesperados.

## Estado

Implementado: landing, schema multi-tenant, webhook con firma y deduplicación,
motor del agente con los cuatro guardrails, captura de leads, escalamiento con
cierre desde el panel, auditoría, métricas, hilo completo de conversación,
configuración del tenant (tono, políticas, catálogo con importación CSV, FAQs)
y login. Aislamiento entre tenants verificado: un tenant recibe 404 al pedir una
conversación de otro.

Verificado end-to-end contra el webhook real: firma HMAC (401 sin ella),
verificación GET, escalamiento por guardrail sin llegar al modelo, aviso al
equipo y **deduplicación** — cuatro entregas del mismo mensaje producen un
mensaje, un escalamiento y un aviso.

El motor de aprobaciones se verificó contra la base real: `AUTOMATICO` ejecuta
al instante; `BLOQUEO` queda pendiente sin ejecutarse; una solicitud repetida no
se duplica; argumentos inválidos se rechazan antes de persistir; una acción
inexistente no hace nada; **una revisión vencida escala y deja el stock intacto**;
aprobar dos veces no re-ejecuta; y aprobar desde otro tenant es imposible.

Pendiente: generación de guías de envío, plantillas de WhatsApp aprobadas para
avisos fuera de la ventana de 24 h, y mover el rate limit a Redis antes de
correr en más de una instancia.
