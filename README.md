# NOVA — Avance 2

NOVA conecta candidatos con empresas que publican oportunidades laborales.

## Alcance de este avance

- Registro, inicio de sesion y cierre de sesion conectados a PostgreSQL.
- Contraseñas cifradas con bcrypt y sesion JWT en cookie `HttpOnly`.
- Dashboard privado con validacion de sesion al abrir y al volver a la pagina.
- CRUD REST de vacantes consumido desde el dashboard. Las empresas administran sus propias vacantes; los candidatos consultan las activas.
- Validaciones de entrada, permisos por rol/propiedad, feedback de carga y errores HTTP.
- Endpoint `GET /health` para comprobar la conexion con PostgreSQL.

La subida de archivos no se implementa porque tiene ponderacion 0% en la rubrica actual. La tabla `archivos` permanece en el esquema para el desarrollo posterior.

## Endpoints

| Metodo y ruta | Acceso | Descripcion |
|---|---|---|
| `POST /api/auth/register` | Publico | Crea una cuenta de candidato o empresa e inicia sesion. |
| `POST /api/auth/login` | Publico | Valida credenciales e inicia sesion. |
| `POST /api/auth/logout` | Publico; limpia la cookie | Cierra la sesion del navegador. |
| `GET /api/auth/me` | Sesion | Devuelve la cuenta autenticada. |
| `GET /api/jobs` | Publico | Lista vacantes activas; acepta `q` para busqueda. |
| `GET /api/jobs/:id` | Publico | Consulta una vacante activa. |
| `GET /api/jobs/mine` | Empresa | Lista vacantes propias. |
| `POST /api/jobs` | Empresa | Crea una vacante. |
| `PUT /api/jobs/:id` | Empresa propietaria | Actualiza una vacante propia. |
| `DELETE /api/jobs/:id` | Empresa propietaria | Elimina una vacante propia. |

## Ejecucion local en Windows

1. Instala Node.js LTS y PostgreSQL con pgAdmin.
2. Crea `nova_db` con `backend/sql/01_create_database.sql` y ejecuta `backend/sql/02_schema.sql` sobre esa base.
3. En `backend/`, copia `.env.example` como `.env`, configura las credenciales de PostgreSQL y cambia `JWT_SECRET` por un valor aleatorio de al menos 32 caracteres. No subas `.env` a Git.
4. En PowerShell, desde `backend/`, ejecuta `npm.cmd install` y `npm.cmd start`.
5. Abre `frontend/` con Live Server en `http://localhost:5500` o `http://127.0.0.1:5500`.
6. Comprueba `http://localhost:3000/health`; debe responder con `status: ok` y `database: connected`.

El esquema actual usa nombres en espanol (`usuarios`, `vacantes`, `perfiles_empresa`); el backend traduce estos nombres al formato JSON de la API. `FRONTEND_ORIGIN` permite configurar el origen de Live Server.