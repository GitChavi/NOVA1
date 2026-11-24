# NOVA — Entrega final

NOVA conecta candidatos con empresas. Las empresas publican vacantes y revisan a sus postulantes; los candidatos se postulan adjuntando su hoja de vida y siguen el estado de cada postulación.

**Ejecución:** local, con datos de demostración (ver [Ejecución local](#ejecución-local-windows)). La aplicación queda lista para desplegarse en Render (ver [Despliegue](#despliegue-render--supabase)).
**Documentación de la API:** `/docs` (Swagger UI) · `/docs.json` (OpenAPI 3)

## Equipo

| Integrante | Rama |
|---|---|
| Katherin Vanessa Cardona Salamanca | `Katherin` |
| Harold Alexander Arce Casanova | `Harold` |
| Javier Lain Valero | `Javier` |
| Ana María Trochez Torres | `Ana` |

Cada integrante trabajó en su propia rama y otro integrante revisó su Pull Request antes de integrarlo a `main`.

## Flujo completo

Landing → Registro/Login → Panel privado → Postularse con hoja de vida (PDF) → **guardado dual** (fichero en Supabase Storage + metadatos en PostgreSQL) → la empresa revisa la hoja de vida y cambia el estado → el candidato consulta su historial.

| Módulo | Qué guarda en la base de datos | Qué guarda en el almacenamiento |
|---|---|---|
| Postulaciones | postulación, estado, mensaje y referencia a la hoja de vida | PDF de la hoja de vida |
| Perfil del candidato | datos profesionales | foto de perfil y hoja de vida reutilizable |
| Perfil de empresa / vacantes | datos de la empresa y vacantes | logo (se muestra en cada vacante) |

## Arquitectura

```
frontend/  HTML + CSS + JavaScript (sin framework)
  js/api.js        cliente HTTP, sesión y utilidades compartidas
  js/auth.js       login y registro
  js/dashboard.js  vacantes, postulaciones y postulantes
  js/profile.js    perfil, foto/logo, hoja de vida y archivos
backend/   Node.js + Express + PostgreSQL
  src/routes/       definición de endpoints
  src/controllers/  lógica de cada recurso
  src/services/     storage.service (Supabase o disco) y files.service (persistencia dual)
  src/middleware/   auth (JWT en cookie), roles, subida (multer) y errores centralizados
  src/docs/         especificación OpenAPI
  SQL/              esquema, migración y datos de demostración
```

- **Sesión:** JWT firmado en cookie `HttpOnly` `nova_session` (8 h); contraseñas con bcrypt; límite de intentos en login y registro (429).
- **Rutas privadas:** `dashboard.html` y `perfil.html` consultan `/api/auth/me` antes de mostrarse; sin sesión redirigen al login, también al volver con el botón “atrás”. Quien ya tiene sesión y abre login/registro va directo a su panel.
- **Subida segura** (`multipart/form-data`, campo `archivo`):
  - El formato se comprueba por los primeros bytes del fichero, no por la extensión ni el `Content-Type`.
  - La hoja de vida solo acepta PDF; las imágenes, PNG, JPG o WEBP.
  - Máximo 5 MB y un archivo por petición.
  - El nombre almacenado es un UUID (`cv/<usuario>/<uuid>.pdf`), así que nada se sobrescribe.
  - Si falla la base de datos, el fichero subido se borra, y viceversa.
- **Acceso a archivos:** el bucket es privado y `/api/files/:id/download` decide quién puede ver cada archivo:
  - El logo es público.
  - La hoja de vida y la foto las ve su dueño y las empresas a cuyas vacantes se postuló.
  - Con Supabase, la descarga se hace mediante una URL firmada que caduca en 60 s.

## Ejecución local (Windows)

Requisitos: Node.js 20 o superior y PostgreSQL 14 o superior.

1. `cd backend` y `npm.cmd install`
2. Copia `.env.example` como `.env` y completa `DB_PASSWORD` y `JWT_SECRET`. Para generar el secreto: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
3. `npm.cmd run db:setup`. Crea `nova_db` si no existe, aplica `SQL/02_schema.sql` y `SQL/03_persistencia_dual.sql` y carga los datos demo de `SQL/04_seed.sql`. Se puede repetir sin duplicar datos. Si solo quieres el esquema sin datos demo, usa `npm.cmd run db:migrate`.
4. `npm.cmd start` y abre **http://localhost:3000**. Express sirve también el frontend. Si prefieres Live Server en `:5500`, también funciona.
5. Comprueba `http://localhost:3000/health` → `{"status":"ok","database":"connected"}`.

Sin claves de Supabase, los archivos se guardan en `backend/uploads/`, que está en `.gitignore`. Al arrancar, el servidor indica qué almacenamiento usa.

### Cuentas de demostración (contraseña `Nova2026`)

| Correo | Rol |
|---|---|
| `empresa@nova.demo` | Empresa (TechNova SAS) |
| `andina@nova.demo` | Empresa (Andina Logística) |
| `candidato@nova.demo` | Candidato |

## Supabase Storage

1. En supabase.com crea un proyecto y, en **Storage → New bucket**, crea `nova-archivos` como **privado**, con límite de 5 MB y tipos `application/pdf, image/png, image/jpeg, image/webp`.
2. Copia en `backend/.env`:
   - `SUPABASE_URL`, desde el botón Connect.
   - `SUPABASE_SECRET_KEY`, la clave `sb_secret_…` de Settings → API Keys. Solo va en el backend; nunca en el frontend ni en Git.
3. Reinicia el backend. Debe mostrar `Almacenamiento de archivos: Supabase Storage, bucket "nova-archivos"`.

## Despliegue (Render + Supabase)

1. **Base de datos:** usa el PostgreSQL del mismo proyecto de Supabase. Copia su cadena de conexión (**Connect → Session pooler**).
2. **Render → New Web Service** desde este repositorio:
   - Root directory: `backend`
   - Build: `npm install`
   - Start: `npm start`
3. Variables de entorno en Render:
   - `NODE_ENV=production`
   - `DATABASE_URL` y `DB_SSL=true`
   - `JWT_SECRET`
   - `SUPABASE_URL`, `SUPABASE_SECRET_KEY` y `SUPABASE_BUCKET=nova-archivos`
   - `STORAGE_DRIVER=supabase`. Render no tiene disco persistente: sin esta variable, el servidor no arranca si faltan las claves de Supabase, en lugar de guardar archivos que se perderían.
4. Una sola vez, desde tu equipo y con esas mismas variables en tu `.env`: `npm.cmd run db:setup`.
5. El mismo servicio sirve frontend y API en un solo dominio, así que no hace falta configurar CORS ni cookies entre dominios.

## Endpoints

| Método y ruta | Acceso | Descripción |
|---|---|---|
| `GET /health` | Público | Estado del servidor y de PostgreSQL (200/503) |
| `POST /api/auth/register` · `login` · `logout` | Público | Cuenta y sesión |
| `GET /api/auth/me` | Sesión | Usuario actual |
| `GET /api/profile` · `PUT /api/profile` | Sesión | Perfil según el rol, con foto/logo y hoja de vida |
| `GET /api/jobs` · `GET /api/jobs/:id` | Público | Vacantes activas (`?q=` para buscar) |
| `GET /api/jobs/mine` | Empresa | Vacantes propias con número de postulantes |
| `POST /api/jobs` · `PUT /api/jobs/:id` · `DELETE /api/jobs/:id` | Empresa dueña | CRUD de vacantes |
| `GET /api/jobs/:id/applications` | Empresa dueña | Postulantes con hoja de vida |
| `POST /api/applications` | Candidato | Postularse (multipart: `job_id`, `message`, `archivo` o `cv_file_id`) |
| `GET /api/applications/mine` | Candidato | Historial de postulaciones |
| `DELETE /api/applications/:id` | Candidato | Retirar la postulación; borra también su hoja de vida |
| `PATCH /api/applications/:id/status` | Empresa dueña | `sent`, `in_review`, `rejected` o `accepted` |
| `POST /api/files` | Sesión | Subir foto o hoja de vida (candidato) o logo (empresa) |
| `GET /api/files/mine` | Sesión | Archivos propios con metadatos |
| `GET /api/files/:id/download` | Según el archivo | Ver o descargar (`?download=1`) |
| `DELETE /api/files/:id` | Dueño | Borrar de la base de datos y del almacenamiento (409 si está adjunto a una postulación) |

Todos los errores responden `{ "error": "mensaje" }` con el código adecuado: 400, 401, 403, 404, 409, 413, 415, 429 o 500.

## Decisiones técnicas (para la sustentación)

- **Supabase Storage en lugar de disco:** Render y Vercel no conservan los archivos al reiniciar. A cambio, se depende de un servicio externo; el disco local se mantiene como respaldo para desarrollo.
- **Subida a través del backend en lugar de URL firmada directa:**
  - Ventaja: el servidor valida el contenido real del fichero, el rol y la vacante antes de guardar, y todo queda en una sola transacción.
  - Costo: cada byte pasa por el servidor. Se acepta porque los archivos son de máximo 5 MB.
- **Cookie `HttpOnly` en lugar de token en `localStorage`:** un script inyectado (XSS) no puede leer la sesión. A cambio, frontend y API deben compartir dominio o configurar `COOKIE_SAMESITE=none`.
- **Metadatos en la tabla `archivos`:** guarda nombre original, peso, tipo MIME, ruta, proveedor, fecha y autor. La hoja de vida de cada postulación se enlaza con una clave foránea (`postulaciones.cv_archivo_id`), y la migración agrega índices para las consultas de la API.
