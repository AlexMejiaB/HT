# Estado de Veloce AI

**Última actualización:** agosto 2026

## Qué es

Marca hermana de Highticket, con el mismo producto y distinta identidad: rojo
`#F4453C` sobre negro, tipografía de peso alto y tracking cerrado.

**Veloce es un cliente activo, no un proyecto archivado.** Vive aquí como
carpeta del repositorio de Highticket para que las dos marcas se mantengan
sincronizadas, pero es una aplicación independiente: su propio `package.json`,
su propia base de datos y su propio despliegue.

## Relación con Highticket

Highticket es el SaaS que se vende por autoservicio. Veloce comparte su código
pero se opera como marca aparte.

En algún momento se planteó recortar Veloce a sólo landing, quitándole panel y
base de datos. **Esa decisión está en pausa** — el producto completo se conserva
intacto. Si algún día se retoma, consiste en quitar `src/app/panel/**`,
`src/app/admin/**`, `src/app/api/**`, `src/proxy.ts` y `prisma/`.

## Puesta en marcha

Es una app independiente: se instala y se corre desde esta carpeta, no desde la
raíz del repositorio.

```bash
cd veloce
pnpm install
cp .env.example .env      # con su PROPIA base de datos, no la de Highticket
pnpm db:generate          # obligatorio: el cliente de Prisma no se versiona
pnpm db:deploy
pnpm dev
```

**Cada marca necesita su propia base de datos.** Compartir una mezclaría las
conversaciones y los catálogos de negocios distintos.

## Avisos propios de este proyecto

**Los historiales de migración de las dos marcas son distintos.** Copiar
`prisma/migrations/` de Highticket aquí mete una migración inicial ajena que
falla con `type "Plan" already exists` y deja un registro bloqueando el
historial. Ya pasó dos veces. Si ocurre: borrar el directorio de esa migración y
su renglón en la tabla `_prisma_migrations`.

**Al replicar cambios desde Highticket, la identidad de marca no se copia.** Los
archivos que NO deben sobrescribirse son `src/lib/site.ts` (contenido
comercial), `src/app/globals.css` (paleta), `src/app/layout.tsx` (tipografía) y
`src/components/marca.tsx` (logotipo).

## Trampas técnicas compartidas

Las que costaron tiempo — tokens de razonamiento de Gemini, las desviaciones de
su capa OpenAI, el `\b` que no reconoce acentos, los regex globales con
`lastIndex`, la detección de tarjetas y la sintaxis de tamaños de Tailwind v4 —
están documentadas en el `ESTADO.md` de la raíz y **aplican igual aquí**. No se
repiten para que haya una sola versión de la verdad.
