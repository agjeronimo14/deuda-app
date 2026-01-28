# Deuda App (ADMIN + contraparte con confirmación)

Esta app es una **PWA** (web instalable) con:
- **Frontend:** React + Vite
- **Backend:** Cloudflare Pages Functions (`/functions/api/*`)
- **DB:** Cloudflare D1 (SQLite)

## Cómo funciona (v3)
- Existe un **ADMIN** (el primer usuario creado se vuelve ADMIN automáticamente).
- El **ADMIN** crea deudas y registra abonos.
- Al crear una deuda, el sistema genera **usuario + contraseña** para la **contraparte** (ya NO hay tokens).
- La contraparte entra, ve sus deudas compartidas y puede **Confirmar / Rechazar** abonos cuando aplique (dirección `I_OWE`).
- Cada abono tiene botón para **exportar recibo en PNG** (desde el navegador).

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
- Ve a **Admin**
- Crea usuarios manualmente o crea deudas (que generan usuario+contraseña de contraparte)

---

## 5) Deploy (Cloudflare Pages)
- Conecta el repo en Cloudflare Pages
- Build command: `npm run build`
- Output dir: `dist`
- Variables:
  - Binding D1: `DB` → tu D1


## Nota (Cloudflare Pages)
- En `wrangler.toml` solo se define `pages_build_output_dir`.
- El comando de build (`npm run build`) se configura en Cloudflare Pages (Build settings) o se detecta automáticamente.
