# NOVA — Avance 1

## ¿Qué es NOVA?

NOVA es una plataforma web de oportunidades laborales que busca conectar a candidatos y empresas en un mismo espacio.

La idea es facilitar el proceso de búsqueda y publicación de empleo, permitiendo que los candidatos puedan crear su perfil, mostrar sus habilidades, consultar vacantes y realizar postulaciones. Por otro lado, las empresas podrán presentar su información, publicar ofertas laborales y gestionar los candidatos interesados.

En este primer avance se construye la base visual y técnica del proyecto, sobre la cual se desarrollarán las funciones completas en los siguientes avances.

---

## Objetivo del proyecto

Desarrollar una aplicación web que permita conectar candidatos y empresas mediante la creación de perfiles, publicación de vacantes, búsqueda de oportunidades y gestión de postulaciones.

---

## ¿Qué incluye el Avance 1?

En esta etapa se trabajó principalmente en la estructura inicial del proyecto y en la interfaz de la plataforma.

### Parte visual

- Landing Page de NOVA.
- Vista de inicio de sesión.
- Vista de registro.
- Selección del tipo de usuario: candidato o empresa.
- Dashboard inicial del usuario.
- Diseño responsive para computador, tablet y celular.
- Logo e icono propios de NOVA.
- Tipografía Agerlas para la identidad visual.
- Paleta de colores basada en navy, azul, púrpura, lavanda, rosa, naranja y crema.
- Efectos de glassmorphism.
- Degradados y elementos visuales.
- Transiciones entre páginas.
- Animaciones de entrada y aparición de elementos.

### Parte técnica

- Separación entre frontend y backend.
- Backend construido con Node.js y Express.
- Conexión inicial con PostgreSQL.
- Endpoint `/health` para comprobar el estado del servidor y la conexión con la base de datos.
- Estructura inicial de las tablas de la plataforma.

---

## Estructura del proyecto

```text
NOVA/
│
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── registro.html
│   ├── dashboard.html
│   │
│   ├── css/
│   │   └── styles.css
│   │
│   ├── js/
│   │   └── main.js
│   │
│   └── assets/
│       ├── nova-logo.png
│       ├── nova-icon.png
│       └── fonts/
│           └── Agerlas-DEMO.ttf
│
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── db.js
│   │   ├── middleware/
│   │   │   └── auth.middleware.js
│   │   ├── routes/
│   │   │   ├── health.routes.js
│   │   │   ├── auth.routes.js
│   │   │   ├── vacantes.routes.js
│   │   │   ├── postulaciones.routes.js
│   │   │   └── archivos.routes.js
│   │   └── controllers/
│   │       ├── auth.controller.js
│   │       ├── vacantes.controller.js
│   │       ├── postulaciones.controller.js
│   │       └── archivos.controller.js
│   │
│   ├── sql/
│   │   ├── 01_create_database.sql
│   │   └── 02_schema.sql
│   │
│   ├── uploads/            # archivos subidos por los usuarios (no se versiona)
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
│
├── .gitignore
└── README.md
```

---

## Avance 2 — API REST implementada

Sobre la base del Avance 1 se construyó el backend funcional completo:

### Autenticación (`/api/auth`)
- `POST /registro` — crea usuario + perfil (candidato o empresa) y devuelve un token JWT.
- `POST /login` — valida credenciales contra la base de datos y devuelve un token JWT.
- `POST /logout` — cierre de sesión (stateless: el cliente descarta el token).

### Vacantes (`/api/vacantes`)
- `GET /` y `GET /:id` — públicas, con filtros por `categoria`, `ubicacion`, `modalidad`.
- `POST /`, `PUT /:id`, `DELETE /:id` — privadas, solo para usuarios `tipo=empresa` dueños de la vacante.
- `GET /:id/postulantes` — privada, solo la empresa dueña.

### Postulaciones (`/api/postulaciones`)
- `POST /` — un candidato se postula a una vacante.
- `GET /mias` — el candidato ve sus propias postulaciones.
- `PUT /:id/estado` — la empresa actualiza el estado de una postulación.

### Archivos (`/api/archivos`) — persistencia dual
- `POST /subir` — sube un archivo físico a `backend/uploads/` (multipart/form-data, campo `archivo`) y registra sus metadatos en la tabla `archivos`.
- `GET /mios` — lista los archivos del usuario autenticado.

Todas las rutas privadas requieren el header `Authorization: Bearer <token>` obtenido en el login/registro.

### Frontend conectado
`frontend/js/main.js` ya no simula el login con `localStorage`: hace `fetch` real contra `/api/auth/login` y `/api/auth/registro`, guarda el token JWT recibido, y `dashboard.html` redirige a `login.html` si no hay una sesión válida.