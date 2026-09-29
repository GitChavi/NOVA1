# NOVA — Avance 1

## Problema y objetivo

NOVA propone un espacio web para conectar candidatos que buscan empleo con empresas que publican oportunidades. El objetivo de este avance es presentar la interfaz inicial y la base técnica del proyecto.

## Alcance de este avance

- Landing page y vistas maquetadas de inicio de sesión y registro.
- Selección del tipo de cuenta: candidato o empresa.
- Diseño adaptable a pantallas de escritorio y móviles.
- Esquema relacional inicial para usuarios, perfiles, habilidades, vacantes, postulaciones y archivos.
- Backend con Node.js y Express, conexión a PostgreSQL y endpoint `GET /health`.

Los formularios de inicio de sesión y registro validan los campos en el navegador; no crean cuentas ni autentican usuarios contra el backend en este avance.

## Arquitectura

El proyecto separa la interfaz estática en `frontend/` y el servidor/API en `backend/`. El endpoint `/health` ejecuta una consulta sencilla a PostgreSQL y devuelve el estado de la conexión.

## Estructura

```text
NOVA/
├── Diagrama ER/
│   └── Empresa y Candidato-2026-09-28-183524.png
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── registro.html
│   ├── dashboard.html
│   ├── css/styles.css
│   ├── js/main.js
│   └── assets/
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── db.js
│   │   └── routes/health.routes.js
│   ├── sql/
│   │   ├── 01_create_database.sql
│   │   └── 02_schema.sql
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
└── README.md
```

## Ejecución básica

1. Crear `backend/.env` a partir de `backend/.env.example` y configurar las credenciales de PostgreSQL.
2. Crear la base de datos y ejecutar el esquema SQL.
3. Desde la carpeta `backend/`, ejecutar `npm install` y luego `npm start`.
4. Consultar `http://localhost:3000/health`. Una respuesta `{"status":"ok","database":"connected"}` confirma la conexión.