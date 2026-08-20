# Despliegue de Highticket

Cómo llevar este proyecto de cero a `https://highticket.app` en un VPS limpio.

## Reparto de entornos

| Entorno | Dónde | Para qué |
|---|---|---|
| Desarrollo | La laptop (`parrot`) | Escribir código y probar. Postgres en podman, puerto 5433 |
| Producción | VPS | Lo que ven los clientes. Postgres del sistema, detrás de túnel |

La laptop **no** es el servidor: es bare metal local. Cualquier URL de
`trycloudflare.com` que veas en el historial era un túnel efímero de pruebas y
**cambia en cada reinicio** — no sirve para Meta ni para Mercado Pago.

## Requisitos del servidor

- Node.js ≥ 20.9 (lo exige Next.js 16)
- pnpm (por corepack: `corepack enable --install-directory ~/.local/bin`)
- PostgreSQL 16 o 17
- `cloudflared`

Ojo con `npm`: en la laptop de desarrollo **no está instalado**, sólo Node y
pnpm por corepack. Si un comando falla con `spawnSync npm ENOENT`, es eso.

## Puesta en marcha

```bash
git clone <url-del-repo> highticket
cd highticket
pnpm install

cp .env.example .env
# llena los valores; los secretos se generan con los comandos que trae el archivo

pnpm db:generate      # obligatorio: el cliente de Prisma no se versiona
pnpm db:deploy        # aplica migraciones (NO uses migrate dev en producción)
pnpm build
pnpm start
```

`pnpm db:generate` no es opcional: `src/generated/` está en `.gitignore`, así
que en un clon nuevo el build falla sin ese paso.

## Dominio y túnel

`.app` está en la lista HSTS preload: **HTTPS obligatorio**, sin fallback a
HTTP. El túnel resuelve el TLS.

```bash
cloudflared tunnel login
cloudflared tunnel create highticket
cloudflared tunnel route dns highticket highticket.app
cloudflared tunnel route dns highticket www.highticket.app
```

Eso crea solo los CNAME en la zona DNS:

| Tipo | Nombre | Contenido | Proxy |
|---|---|---|---|
| CNAME | `@` | `<UUID>.cfargotunnel.com` | Sí |
| CNAME | `www` | `<UUID>.cfargotunnel.com` | Sí |

Los nameservers del dominio deben apuntar a Cloudflare (los que te dé tu panel).

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

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

No se abre ningún puerto: el túnel sale de dentro hacia afuera.

## La app como servicio

`/etc/systemd/system/highticket.service`:

```ini
[Unit]
Description=Highticket
After=network.target postgresql.service

[Service]
Type=simple
User=highticket
WorkingDirectory=/srv/highticket
EnvironmentFile=/srv/highticket/.env
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -p 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## Conectar WhatsApp

El webhook queda en `https://highticket.app/api/webhooks/whatsapp`.

1. En la app de Meta, pega esa URL y el valor de `META_VERIFY_TOKEN`.
2. Suscríbete al campo `messages`.
3. Cada negocio conecta su número desde `/panel/canales` — ahí van su
   `phone_number_id` y su token, que se guardan cifrados.

El verify token y el app secret son **globales del sistema**; el
`phone_number_id` y el token son **por negocio**. No los confundas: el primero
lo administra quien opera Highticket, los segundos los pega cada cliente.

## Verificación

```bash
curl -I https://highticket.app                      # 200 + HSTS
curl "https://highticket.app/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=TU_TOKEN&hub.challenge=ok"
pnpm llm:probar                                     # el modelo responde
pnpm test                                           # 101 pruebas, sin base de datos
```

La prueba definitiva es escribirle al número conectado desde otro teléfono y ver
la conversación aparecer en `/panel/conversaciones`.

## Respaldos

La base tiene conversaciones de clientes reales y credenciales cifradas de
terceros. Un `pg_dump` diario como mínimo.

**`CLAVE_CIFRADO` se respalda aparte y nunca junto al dump.** Si se pierde esa
clave, los tokens de WhatsApp y de las tiendas de todos los negocios quedan
ilegibles y hay que reconectarlos uno por uno.
