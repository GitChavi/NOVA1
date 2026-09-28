# NOVA — Avance 1

## ¿Qué es NOVA?

NOVA es una plataforma web de oportunidades laborales que busca conectar a candidatos y empresas en un mismo espacio.

La propuesta facilita la búsqueda y publicación de empleo: los candidatos pueden presentar su perfil y consultar oportunidades, mientras las empresas pueden describir sus vacantes.

## Objetivo del proyecto

Diseñar la base visual y técnica de una aplicación web para conectar candidatos y empresas mediante perfiles, vacantes y postulaciones.

## ¿Qué incluye el Avance 1?

### Parte visual

- Landing page de NOVA.
- Vistas iniciales de inicio de sesión, registro y dashboard.
- Selección de tipo de usuario en el formulario de registro.
- Diseño adaptable a pantallas pequeñas y grandes.
- Identidad visual sencilla basada en la marca NOVA, colores y estilos propios.

Los formularios validan campos en el navegador. La autenticación y las operaciones de usuarios todavía no están conectadas al backend.

### Parte técnica

- Frontend en HTML, CSS y JavaScript.
- Backend básico con Node.js y Express.
- Endpoint `GET /health`, que comprueba la conexión con PostgreSQL.
- Esquema inicial para usuarios, perfiles, vacantes, postulaciones y archivos.

## Estructura del proyecto

```text
NOVA/
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── registro.html
│   ├── dashboard.html
│   ├── css/styles.css
│   └── js/main.js
├── backend/
│   ├── src/app.js
│   ├── src/db.js
│   ├── src/routes/health.routes.js
│   ├── sql/01_create_database.sql
│   ├── sql/02_schema.sql
│   ├── package.json
│   └── .env.example
├── .gitignore
└── README.md
```
