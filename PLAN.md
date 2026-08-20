# Highticket como SaaS comercial en highticket.app

## Contexto

Highticket y Veloce nacieron como proyectos gemelos: la misma oferta con dos
marcas. Esa simetría deja de tener sentido — **sólo Highticket será el SaaS**, y
Veloce queda reducido a una landing de presentación.

Hoy Highticket es técnicamente multi-tenant pero **comercialmente es una
agencia**: los negocios sólo pueden darse de alta desde una consola interna, la
contraseña se pasa a mano, no hay forma de cobrar, y el plan contratado **no
restringe absolutamente nada** — un cliente de $2,990 tiene hoy el mismo acceso
que uno de $9,990. Además falta la pieza más básica para operar: **no existe
ninguna pantalla para conectar WhatsApp**, aunque el webhook y el envío ya
funcionen.

Con el dominio `highticket.app` ya comprado, el objetivo es cerrar esas brechas
y dejarlo cobrando solo.

---

## Bloqueos que dependen de ti, no del código

Tres cosas no las puedo resolver escribiendo código. Conviene arrancarlas ya
porque tienen tiempos de espera externos:

| Bloqueo | Por qué | Tiempo estimado |
|---|---|---|
| **Conectar la USB `IT`** | Sin ella no hay acceso al VPS ni, muy probablemente, a las credenciales que pediste (ver abajo). | Inmediato |
| **Meta Tech Provider** | Embedded Signup exige Business Verification + App Review con acceso avanzado. Sin eso, ningún cliente puede conectar su WhatsApp con un botón. | Semanas |
| **Cuenta de Mercado Pago** | Credenciales de producción para suscripciones (`preapproval`) y la clave secreta del webhook. | Días |

### Sobre las credenciales de `tynaxclub`

**No están en esta máquina.** Busqué el nombre en todo el home y no existe
ningún archivo ni `.env` con credenciales de Cloudflare. Lo más probable es que
`tynaxclub` esté desplegado **en el VPS**, y para leer su `.env` hace falta
entrar por SSH.

Eso arrastra un requisito físico: la llave `sunny_vps_key` vive **sólo en la USB
con etiqueta `IT`**, y ahora mismo `/media/xkush/IT` está vacío — la USB no está
conectada. El acceso pasa por `prod-usb-mount`, que copia la llave a RAM.

Cuidado al intentarlo: el servidor corre `fail2ban` con `maxretry=3` y ban
incremental. Una racha de intentos fallidos deja el puerto 22 respondiendo
`Connection refused`, que **parece el servicio caído sin serlo**. Si pasa, se
verifica contra el 443, que sigue abierto.

**Nada de esto bloquea el resto del plan**, siempre que construyamos el camino
manual antes que el automático (ver Fase 2).

---

## Los DNS records que pediste

`.app` está en la lista HSTS preload: **HTTPS es obligatorio**, no hay
fallback a HTTP. El túnel de Cloudflare resuelve el TLS solo.

### Paso 1 — Nameservers (en tu registrador)

Cloudflare te asigna un par propio al añadir el dominio. Serán del estilo:

```
ns1.cloudflare.com
ns2.cloudflare.com
```

Usa **los que te muestre tu panel de Cloudflare**, no estos literales.

### Paso 2 — El túnel crea el CNAME solo

```bash
cloudflared tunnel login
cloudflared tunnel create highticket
cloudflared tunnel route dns highticket highticket.app
cloudflared tunnel route dns highticket www.highticket.app
```

Resultado en la zona DNS:

| Tipo | Nombre | Contenido | Proxy |
|---|---|---|---|
| CNAME | `@` | `<UUID>.cfargotunnel.com` | Sí (naranja) |
| CNAME | `www` | `<UUID>.cfargotunnel.com` | Sí (naranja) |

No se abre ningún puerto del VPS: el túnel sale de dentro hacia afuera.

### Paso 3 — Config del túnel en el VPS

`/etc/cloudflared/config.yml`:

```yaml
tunnel: <UUID>
credentials-file: /etc/cloudflared/<UUID>.json
ingress:
  - hostname: highticket.app
    service: http://localhost:3000
  - hostname: www.highticket.app
    service: http://localhost:3000
  - service: http_status:404
```

### Paso 4 — Correo transaccional (necesario para el registro)

El registro autoservicio necesita verificar correos y permitir recuperar
contraseñas, y **hoy no hay ninguna infraestructura de correo en el proyecto**.
Estos records dependen del proveedor que elijas; con Resend serían:

| Tipo | Nombre | Contenido |
|---|---|---|
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` (prioridad 10) |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |
| TXT | `resend._domainkey` | (la clave DKIM que te dé el panel) |
| TXT | `_dmarc` | `v=DMARC1; p=none;` |

Los valores exactos los emite el proveedor al verificar el dominio.

---

## Fases

Cada fase termina en algo probable de punta a punta. El orden está pensado para
que los trámites externos no detengan el avance.

### Fase 1 — Desplegar lo que ya existe

Objetivo: `https://highticket.app` sirviendo el producto actual, con una URL
estable que Meta y Mercado Pago puedan usar como webhook.

Destino: el VPS Hetzner `prod` (CX33, 8 GB, Helsinki, `204.168.157.136`), al que
ya se accede con `ssh prod` una vez conectada la USB.

- Postgres del VPS (no el contenedor podman de desarrollo), con respaldos.
- `cloudflared` como servicio systemd, no un proceso suelto como en desarrollo.
- Variables de entorno de producción; secretos fuera del repo.
- `NEXT_PUBLIC_SITE_URL=https://highticket.app`.
- `NEXT_PUBLIC_WHATSAPP_NUMERO=524445587796` — tu contacto directo en la landing.

Nota de latencia: el servidor está en Helsinki y los clientes en México, unos
150-200 ms de ida y vuelta. Para webhooks es irrelevante (se procesan en
`after()`), pero el panel se sentirá un poco lento. Si molesta, la solución es
mover el VPS a una región americana, no optimizar código.

**Verificación:** `curl -I https://highticket.app` responde 200 con HSTS; el
panel entra; el webhook responde al reto GET de Meta.

### Fase 2 — Conectar WhatsApp (el camino manual, primero)

Es la brecha más urgente: el webhook lee `waPhoneNumberId` y `waTokenCifrado`,
pero **nadie los escribe**. Ni siquiera el seed fija `waPhoneNumberId`, así que
el tenant piloto no puede recibir un solo mensaje.

Archivos:

- `src/app/panel/canales/page.tsx` + `formularios.tsx` — pantalla nueva.
- `src/lib/acciones/canales.ts` — action `guardarCanales`, copiando el patrón ya
  probado de `guardarTienda` en `src/lib/acciones/configuracion.ts:271-307`
  (campo vacío = "no lo cambies", `cifrar()` en la action, auditoría,
  `revalidatePath`).
- `src/app/panel/layout.tsx` — entrada "Canales" en el nav.
- Manejar el choque de `@unique` en `waPhoneNumberId` / `igCuentaId`: hoy dos
  tenants con el mismo id producirían un `P2002` crudo en pantalla.
- Botón "probar conexión" que envía un mensaje real, al estilo de
  `scripts/probar-llm.ts`.

Limpieza: `waVerifyTokenHash` no se referencia en ningún lado y
`waNumeroVisible` nunca se lee — decidir si se pueblan o se eliminan.

**El número +52 444 558 7796 no entra aquí.** Es tu contacto directo, así que va
en `NEXT_PUBLIC_WHATSAPP_NUMERO` (la landing), no en un tenant.

**Verificación:** conectas un número desde el panel, le escribes desde otro
teléfono y el agente contesta con datos reales del catálogo.

### Fase 3 — Que el plan signifique algo

Hoy `plan` es decorativo: cero comparaciones en todo el código. Antes de cobrar
por planes distintos, tienen que serlo.

- `src/lib/planes.ts` — **única fuente de verdad** que mapea plan → capacidades
  (`instagram`, `conector_tienda`, `aprobaciones`, `lineas`, `guias`,
  `inventario`, `compras`) y su límite de mensajes.
- Aplicarlo en los puntos que hoy sólo piden permiso: `src/app/panel/tienda/**`,
  el enrutado de Instagram en el webhook, `src/lib/aprobaciones/*`,
  `src/app/panel/lineas/**`.
- **Sacar `limiteMensajesMes` del formulario del cliente**: hoy el dueño puede
  borrarse su propio tope desde `/panel/configuracion`. Debe derivarse del plan.

**Verificación:** un tenant en RESPONDE ve las secciones de Autopilot
bloqueadas con un aviso de "mejora tu plan", y su tope de mensajes es el del
plan, no uno que él eligió.

### Fase 4 — Autopilot opera de verdad

El plan caro debe **hacer todo menos empacar la caja**: generar guías, manejar
inventario, y comprar y actualizar existencias.

Todo pasa por el motor de aprobaciones que ya existe
(`src/lib/aprobaciones/motor.ts`), con el nivel que corresponde a su riesgo:

| Acción nueva | Nivel | Por qué |
|---|---|---|
| `consultar_inventario` | `AUTOMATICO` | Sólo lee |
| `ajustar_stock` (ya existe) | `REVISION` | Descuadrar inventario cuesta ventas |
| `generar_guia` | `REVISION` | Cuesta dinero y es difícil de deshacer |
| `crear_orden_compra` | `BLOQUEO` | Compromete dinero con un proveedor |
| `recibir_mercancia` | `REVISION` | Actualiza existencias contra una compra |

Requiere un conector de paquetería (Skydropx, Envia.com o similar) siguiendo el
contrato de `src/lib/tienda/tipos.ts`, y modelos nuevos `Proveedor` y
`OrdenCompra`.

Los guardrails actuales **escalan** ante "guía" y "número de rastreo"
(`src/lib/agente/guardrails.ts`). Hay que hacer esa regla condicional al plan:
en Autopilot deja de escalar y pasa a solicitar la acción por el motor de
aprobaciones. En los planes de abajo sigue escalando como hoy.

### Copy de la landing

`src/lib/site.ts`, paquete `autopilot` — el gancho y los puntos pasan a decir
explícitamente el alcance:

> **Gancho:** Opera tu tienda completa. Tú sólo empacas.
>
> - Todo lo de Highticket Operador.
> - Generación de guías de envío.
> - Manejo de inventario: altas, ajustes y conteos.
> - Compra a proveedores y actualización de existencias al recibir.
> - Flujos para inventario bajo, pedidos y casos especiales.
> - Panel de métricas y revisión mensual.
> - Soporte prioritario.
>
> **Nota operativa:** el agente ejecuta toda la operación excepto el embalaje
> físico. Las acciones que mueven dinero o son irreversibles se habilitan sólo
> después de aprobación, pruebas y reglas por cliente.

La nota operativa es importante que se quede: vender "hace todo solo" y luego
pedir autorización para cada compra genera una expectativa que el producto no
cumple. La promesa honesta es que **el agente prepara y ejecuta; tú autorizas lo
que compromete dinero**, y con el tiempo se van soltando las de bajo riesgo.

**Verificación:** pides una guía por WhatsApp, aparece en la cola de
aprobaciones con su contexto, la autorizas y el número de rastreo llega al
cliente.

### Fase 5 — Registro autoservicio

- Correo transaccional (Resend o similar) — hoy no hay nada.
- `src/app/registro/**` — alta pública que crea Tenant + Usuario `DUENO` con
  contraseña elegida por el usuario, no generada.
- Verificación de correo y recuperación de contraseña, que hoy no existen.
- Asistente de puesta en marcha: conectar WhatsApp → cargar catálogo → probar.
- Arreglar el login: hoy busca el correo con `findFirst` **global** mientras el
  schema define `@@unique([tenantId, email])`. Dos tenants con el mismo correo
  romperían el acceso.
- Antiabuso en el alta reutilizando `src/lib/rate-limit.ts`.

**Verificación:** alguien sin cuenta llega a la landing, se registra, verifica
su correo y llega al panel sin que nadie intervenga.

### Fase 6 — Cobro con Mercado Pago

Modelos nuevos en `prisma/schema.prisma`:

```prisma
enum EstadoSuscripcion {
  PRUEBA      // sin tarjeta todavía, con fecha de corte
  ACTIVA
  MOROSA      // falló un cobro; aún opera, con aviso
  SUSPENDIDA  // se agotaron los reintentos; el agente ya no responde
  CANCELADA   // el cliente la dio de baja
}

model Suscripcion {
  id       String @id @default(cuid())
  tenantId String @unique          // una por negocio
  tenant   Tenant @relation(...)

  plan   Plan
  estado EstadoSuscripcion @default(PRUEBA)

  /// Ids de Mercado Pago. El preapprovalId es la suscripción viva.
  mpPreapprovalId     String? @unique
  mpPreapprovalPlanId String?
  mpPayerId           String?

  pruebaHasta   DateTime?
  periodoInicio DateTime?
  periodoFin    DateTime?
  /// Cuándo dejar de reintentar y suspender.
  graciaHasta   DateTime?
  canceladaEn   DateTime?

  montoCentavos Int
  moneda        String @default("MXN")

  pagos PagoSuscripcion[]
}

model PagoSuscripcion {
  id            String @id @default(cuid())
  suscripcionId String
  suscripcion   Suscripcion @relation(...)

  mpPaymentId   String @unique   // idempotencia natural del webhook
  estado        String           // approved | rejected | pending
  montoCentavos Int
  fecha         DateTime
  detalle       Json?
}
```

`Tenant.plan` se conserva como el plan **efectivo** (lo que desbloquea hoy) y
`Suscripcion.plan` es el **contratado**. Se separan a propósito: al suspender por
impago el efectivo baja sin perder memoria de lo que el cliente pagaba.
- `src/app/api/webhooks/mercadopago/route.ts`. La validación de firma es
  **casi idéntica a la de Meta que ya tenemos**: cabecera `x-signature` con
  formato `ts=<epoch>,v1=<hmac>`, HMAC-SHA256 sobre un manifiesto armado con
  `data.id`, la cabecera `x-request-id` y el `ts`, contra la clave secreta de la
  aplicación. Se reutiliza el patrón de `firmaMetaValida()`
  (`src/lib/cifrado.ts:35`), incluida la comparación con `timingSafeEqual`.
- Eventos a escuchar: `subscription_preapproval` (alta y cambios de la
  suscripción) y `subscription_authorized_payment` (cada cobro recurrente).
- **Idempotencia reutilizando `ClaveIdempotencia`**, igual que el webhook de
  WhatsApp deduplica por `waMessageId`: Mercado Pago reintenta las
  notificaciones, y procesar dos veces un cobro descuadraría el estado.
### Degradación por impago, gradual

Un cliente que deja de pagar no debe perder sus datos ni dejar a **sus** clientes
hablando solos. La escalera:

| Estado | Qué pasa con el agente | Qué ve el dueño |
|---|---|---|
| `PRUEBA` | Responde normal, con el límite del plan | Días restantes en el panel |
| `ACTIVA` | Responde normal | Nada |
| `MOROSA` | **Sigue respondiendo** | Aviso en el panel y por WhatsApp |
| `SUSPENDIDA` | Deja de responder y **escala todo a una persona** | Panel en sólo lectura |
| `CANCELADA` | No responde | Puede exportar sus datos 30 días |

El punto importante: en `SUSPENDIDA` el agente **no se calla** — entrega los
casos a un humano, igual que cuando se agota el límite mensual
(`src/lib/agente/motor.ts`). El cliente final nunca queda sin respuesta por un
problema de cobranza entre nosotros y la tienda.

`Tenant.activo` deja de moverse a mano y pasa a derivarse del estado de pago.
La suspensión manual desde `/admin` se conserva para casos de abuso.

**Verificación:** te suscribes con una tarjeta de prueba, el webhook activa la
cuenta, y al simular un impago la cuenta degrada sin borrar nada.

### Fase 7 — Veloce a sólo landing

- Quitar `src/app/panel/**`, `src/app/admin/**`, `src/app/api/**`, `proxy.ts`,
  Prisma y las dependencias de servidor.
- Queda la landing estática que manda a WhatsApp.

**Verificación:** `pnpm build` de Veloce produce sólo rutas estáticas.

---

## Riesgos

**Embedded Signup no funcionará hasta que Meta apruebe.** Por eso la Fase 2
construye primero la entrada manual de credenciales: sirve desde el primer día y
el botón de Meta se añade encima cuando llegue la aprobación. Además, la v2 se
deprecia el 15 de octubre de 2026 — hay que integrar directamente contra v4.

**El rate limit vive en memoria del proceso** (`src/lib/rate-limit.ts`). En
cuanto haya más de una instancia, el límite se multiplica por el número de
procesos. Mover a Redis antes de escalar horizontalmente.

**Las sesiones no se revocan.** Suspender un tenant no expulsa las sesiones
vivas: `leerSesion()` no revalida `Tenant.activo`. Un cliente suspendido sigue
dentro hasta 8 horas. Hay que revalidar el estado en cada carga del panel.

**El primer `SOPORTE_VELOCE` sólo nace por SQL.** Ni la consola de admin ni
`invitarUsuario` pueden crear ese rol. Hace falta un comando de arranque.

---

## Verificación global

```bash
pnpm test          # 93 pruebas actuales, sin base de datos
pnpm build
pnpm llm:probar    # conexión con Gemini de punta a punta
```

Y sobre el dominio ya desplegado: registro → verificación de correo → conectar
WhatsApp → escribirle al número desde un teléfono real → ver la conversación en
el panel → suscribirse → confirmar que el webhook de Mercado Pago activó la
cuenta.
