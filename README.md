# Deuda App (control personal + reporte para contraparte)

Esta app es una **PWA** (web instalable) con:
- **Frontend:** React + Vite
- **Backend:** Cloudflare Pages Functions (`/functions/api/*`)
- **DB:** Cloudflare D1 (SQLite)

## Cómo funciona
- Existe un **ADMIN** (el primer usuario creado se vuelve ADMIN automáticamente).
- El **ADMIN** crea usuarios, deudas y registra abonos.
- Los movimientos se confirman de inmediato por defecto. Si una contraparte quiere participar, el owner puede activar la confirmación para esa deuda.
- Los abonos que hayan quedado pendientes antes de este cambio se pueden confirmar desde la propia deuda, sin entrar a otra cuenta.
- Cada deuda permite generar un **reporte PNG** y un **enlace privado de solo lectura**, revocable y con vencimiento opcional. La contraparte no necesita iniciar sesión para abrirlo.
- Si la contraparte tiene cuenta, puede seguir entrando y participando en las deudas donde se active la confirmación.

---

## Requisitos
- Node.js 18+ (recomendado 20)
- Cuenta Cloudflare
- `wrangler` (devDependency)

---

## 1) Instalar
```bash
npm install
```

---

## 2) Crear y preparar la DB (D1)

Login:
```bash
npx wrangler login
```

Crear DB:
```bash
npx wrangler d1 create debt_app_db
```

Copia el `database_id` que te devuelve y pégalo en `wrangler.toml`.

Aplicar migraciones:
```bash
npx wrangler d1 migrations apply debt_app_db --local
npx wrangler d1 migrations apply debt_app_db --remote
```

> Importante para Cloudflare Pages: **aplica la migración remota antes de pushear** el código nuevo, para evitar que el deploy corra con columnas faltantes.

> La migración `0005_personal_control_and_public_links.sql` es necesaria para el modo personal y los enlaces de reporte.

---

## 3) Correr en local (con HMR + Functions)
```bash
npm run start
```

Abre:
- http://localhost:8788

---

## 4) ADMIN: crear usuarios (panel)
En producción:
- Entra con tu usuario ADMIN
- Ve a **Admin** para crear, activar, desactivar o administrar usuarios.
- Al crear una deuda, asigna una cuenta de contraparte que ya exista; no se crean cuentas automáticamente.

## 5) Compartir el estado de una deuda

- Abre una deuda y usa **Compartir reporte PNG** para enviarlo rápido por WhatsApp u otra app.
- Usa **Generar y copiar enlace** para compartir una página de solo lectura. Selecciona el vencimiento antes de generarlo.
- Renovar el enlace invalida el anterior; **Desactivar enlace** lo corta de inmediato.
- Si hay movimientos antiguos en estado `PENDING`, usa **Confirmar pendientes** desde la misma deuda.

---

## 6) Deploy (Cloudflare Pages)
- Conecta el repo en Cloudflare Pages
- Build command: `npm run build`
- Output dir: `dist`
- Variables:
  - Binding D1: `DB` → tu D1


## Nota (Cloudflare Pages)
- En `wrangler.toml` solo se define `pages_build_output_dir`.
- El comando de build (`npm run build`) se configura en Cloudflare Pages (Build settings) o se detecta automáticamente.
