-- Datos de demostracion. Todas las cuentas usan la contrasena: Nova2026
-- Se puede ejecutar varias veces: no duplica usuarios ni vacantes.
INSERT INTO usuarios (nombre, email, password_hash, tipo, telefono) VALUES
  ('TechNova SAS', 'empresa@nova.demo', '$2a$12$cbV6G37DTsqfdnYWtSAE9.nrZittIZcHDGqJW0QqumjmsZY9AHTpS', 'empresa', '+57 602 555 0101'),
  ('Andina Logistica', 'andina@nova.demo', '$2a$12$cbV6G37DTsqfdnYWtSAE9.nrZittIZcHDGqJW0QqumjmsZY9AHTpS', 'empresa', '+57 602 555 0202'),
  ('Laura Gomez', 'candidato@nova.demo', '$2a$12$cbV6G37DTsqfdnYWtSAE9.nrZittIZcHDGqJW0QqumjmsZY9AHTpS', 'candidato', '+57 300 555 0303')
ON CONFLICT (email) DO NOTHING;

INSERT INTO perfiles_empresa (usuario_id, nombre_empresa, nit, sector, descripcion, sitio_web)
SELECT id, nombre, '900123456-1', 'Tecnologia', 'Desarrollamos software a la medida para el sector salud y educacion.', 'https://technova.example'
FROM usuarios WHERE email = 'empresa@nova.demo'
ON CONFLICT (usuario_id) DO NOTHING;

INSERT INTO perfiles_empresa (usuario_id, nombre_empresa, nit, sector, descripcion, sitio_web)
SELECT id, nombre, '901987654-3', 'Logistica', 'Operador logistico con presencia en el suroccidente colombiano.', 'https://andina.example'
FROM usuarios WHERE email = 'andina@nova.demo'
ON CONFLICT (usuario_id) DO NOTHING;

INSERT INTO perfiles_candidato (usuario_id, titulo_profesional, ubicacion, resumen)
SELECT id, 'Desarrolladora Frontend', 'Cali, Colombia', 'Estudiante de ingenieria multimedia con experiencia en JavaScript, HTML y CSS.'
FROM usuarios WHERE email = 'candidato@nova.demo'
ON CONFLICT (usuario_id) DO NOTHING;

INSERT INTO vacantes (empresa_id, titulo, descripcion, categoria, ubicacion, modalidad, salario_min, salario_max,
                      experiencia_minima, tipo_contrato, jornada, numero_vacantes, fecha_cierre, estado)
SELECT u.id, v.titulo, v.descripcion, v.categoria, v.ubicacion, v.modalidad, v.salario_min, v.salario_max,
       v.experiencia, v.contrato, v.jornada, v.cupos, CURRENT_DATE + v.dias, v.estado
FROM (VALUES
  ('empresa@nova.demo', 'Desarrollador Frontend Junior', 'Construiras interfaces accesibles con HTML, CSS y JavaScript. Trabajo en equipo con diseno y backend.', 'Tecnologia', 'Cali', 'Hibrido', 2800000, 3600000, '6 meses', 'Termino indefinido', 'Tiempo completo', 2, 30, 'activa'),
  ('empresa@nova.demo', 'Practicante de Diseno UX', 'Apoyo en investigacion de usuarios, prototipos en Figma y pruebas de usabilidad.', 'Diseno', 'Remoto', 'Remoto', 1300000, 1300000, 'Sin experiencia', 'Aprendizaje', 'Medio tiempo', 1, 20, 'activa'),
  ('empresa@nova.demo', 'Ingeniero Backend Node.js', 'API REST con Express y PostgreSQL. Deseable experiencia con almacenamiento en la nube.', 'Tecnologia', 'Bogota', 'Presencial', 5500000, 7000000, '2 anos', 'Termino indefinido', 'Tiempo completo', 1, 45, 'borrador'),
  ('andina@nova.demo', 'Analista de Datos Logisticos', 'Construccion de tableros y analisis de rutas de distribucion.', 'Analitica', 'Yumbo', 'Hibrido', 3200000, 4200000, '1 ano', 'Termino fijo', 'Tiempo completo', 1, 25, 'activa')
) AS v(email, titulo, descripcion, categoria, ubicacion, modalidad, salario_min, salario_max, experiencia, contrato, jornada, cupos, dias, estado)
JOIN usuarios u ON u.email = v.email
WHERE NOT EXISTS (SELECT 1 FROM vacantes x WHERE x.empresa_id = u.id AND x.titulo = v.titulo);
