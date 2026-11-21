-- Entrega final: persistencia dual (fichero en Supabase Storage o disco + metadatos aqui).
-- Es idempotente: se puede ejecutar sobre una base creada con 02_schema.sql sin perder datos.

-- Donde quedo guardado el fichero fisico. ruta_almacenamiento es la clave del objeto
-- dentro del bucket (o la ruta relativa en disco) y siempre lleva un UUID, asi que es unica.
ALTER TABLE archivos ADD COLUMN IF NOT EXISTS proveedor VARCHAR(20) NOT NULL DEFAULT 'local';
DO $$ BEGIN
  ALTER TABLE archivos ADD CONSTRAINT archivos_proveedor_check CHECK (proveedor IN ('supabase', 'local'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE archivos ADD CONSTRAINT archivos_ruta_unica UNIQUE (ruta_almacenamiento);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE archivos ADD CONSTRAINT archivos_peso_positivo CHECK (peso_bytes > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Cada postulacion referencia la hoja de vida que el candidato adjunto.
ALTER TABLE postulaciones ADD COLUMN IF NOT EXISTS cv_archivo_id INTEGER REFERENCES archivos(id) ON DELETE SET NULL;
ALTER TABLE postulaciones ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Indices para las consultas que hace la API.
CREATE INDEX IF NOT EXISTS idx_vacantes_estado_fecha ON vacantes (estado, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_vacantes_empresa ON vacantes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_postulaciones_candidato ON postulaciones (candidato_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_archivos_usuario_tipo ON archivos (usuario_id, tipo, subido_en DESC);
CREATE INDEX IF NOT EXISTS idx_archivos_entidad ON archivos (entidad, entidad_id);
