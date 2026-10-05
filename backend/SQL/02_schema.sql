-- Modelo inicial del dominio. Las tablas de vacantes, habilidades,
-- postulaciones y archivos quedan preparadas para los siguientes avances.
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('candidato','empresa')),
  telefono VARCHAR(30),
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS perfiles_candidato (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo_profesional VARCHAR(160), ubicacion VARCHAR(120), resumen TEXT
);
CREATE TABLE IF NOT EXISTS perfiles_empresa (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre_empresa VARCHAR(160) NOT NULL, nit VARCHAR(60), sector VARCHAR(120), descripcion TEXT, sitio_web VARCHAR(200)
);
CREATE TABLE IF NOT EXISTS habilidades (
  id SERIAL PRIMARY KEY, nombre VARCHAR(120) NOT NULL UNIQUE, categoria VARCHAR(120)
);
CREATE TABLE IF NOT EXISTS vacantes (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo VARCHAR(180) NOT NULL, descripcion TEXT NOT NULL, categoria VARCHAR(120), ubicacion VARCHAR(120), modalidad VARCHAR(60),
  salario_min NUMERIC(12,2), salario_max NUMERIC(12,2), experiencia_minima VARCHAR(120), tipo_contrato VARCHAR(80), jornada VARCHAR(80),
  numero_vacantes INTEGER NOT NULL DEFAULT 1 CHECK (numero_vacantes > 0), fecha_cierre DATE,
  estado VARCHAR(20) NOT NULL DEFAULT 'borrador' CHECK (estado IN ('activa','cerrada','borrador')), creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS candidato_habilidades (
  id SERIAL PRIMARY KEY,
  candidato_id INTEGER NOT NULL REFERENCES perfiles_candidato(id) ON DELETE CASCADE,
  habilidad_id INTEGER NOT NULL REFERENCES habilidades(id) ON DELETE CASCADE,
  nivel VARCHAR(20) NOT NULL CHECK (nivel IN ('basico','intermedio','avanzado')),
  anios_experiencia INTEGER NOT NULL DEFAULT 0 CHECK (anios_experiencia >= 0),
  UNIQUE (candidato_id, habilidad_id)
);
CREATE TABLE IF NOT EXISTS vacante_habilidades (
  id SERIAL PRIMARY KEY,
  vacante_id INTEGER NOT NULL REFERENCES vacantes(id) ON DELETE CASCADE,
  habilidad_id INTEGER NOT NULL REFERENCES habilidades(id) ON DELETE CASCADE,
  nivel_requerido VARCHAR(20) NOT NULL CHECK (nivel_requerido IN ('basico','intermedio','avanzado')),
  obligatoria BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (vacante_id, habilidad_id)
);
CREATE TABLE IF NOT EXISTS postulaciones (
  id SERIAL PRIMARY KEY,
  vacante_id INTEGER NOT NULL REFERENCES vacantes(id) ON DELETE CASCADE,
  candidato_id INTEGER NOT NULL REFERENCES perfiles_candidato(id) ON DELETE CASCADE,
  mensaje TEXT,
  estado VARCHAR(20) NOT NULL DEFAULT 'enviada' CHECK (estado IN ('enviada','en_revision','rechazada','aceptada')),
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (vacante_id, candidato_id)
);
CREATE TABLE IF NOT EXISTS archivos (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo VARCHAR(30) NOT NULL, entidad VARCHAR(30) NOT NULL, entidad_id INTEGER,
  nombre_original VARCHAR(255) NOT NULL, ruta_almacenamiento TEXT NOT NULL, peso_bytes BIGINT, mime_type VARCHAR(100),
  subido_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (tipo IN ('cv','logo','foto_perfil','adjunto')),
  CHECK (entidad IN ('usuario','postulacion'))
);
