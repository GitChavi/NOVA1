// Especificacion OpenAPI 3 de la API de NOVA. Se sirve en /docs (Swagger UI) y /docs.json.
const json = (schema) => ({ 'application/json': { schema } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const error = (description) => ({ description, content: json(ref('Error')) });
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } };
const auth = [{ cookieAuth: [] }];
const common = { 400: error('Datos invalidos'), 401: error('Sin sesion'), 403: error('Rol sin permiso'), 500: error('Error interno') };

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'NOVA API',
    version: '2.0.0',
    description: 'API REST de NOVA: autenticacion, vacantes, postulaciones con hoja de vida y archivos con persistencia dual '
      + '(fichero en Supabase Storage o disco + metadatos en PostgreSQL). La sesion viaja en la cookie HttpOnly nova_session: '
      + 'inicia sesion con POST /api/auth/login desde esta misma pagina y las demas peticiones la envian solas.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Salud' }, { name: 'Autenticacion' }, { name: 'Perfil' }, { name: 'Vacantes' },
    { name: 'Postulaciones' }, { name: 'Archivos' },
  ],
  components: {
    securitySchemes: { cookieAuth: { type: 'apiKey', in: 'cookie', name: 'nova_session' } },
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'string' } } },
      User: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' }, email: { type: 'string' }, type: { type: 'string', enum: ['candidato', 'empresa'] } } },
      File: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, kind: { type: 'string', enum: ['cv', 'logo', 'foto_perfil'] },
          original_name: { type: 'string' }, size_bytes: { type: 'integer' }, mime_type: { type: 'string' },
          uploaded_at: { type: 'string', format: 'date-time' }, url: { type: 'string', example: '/api/files/7/download' },
        },
      },
      JobInput: {
        type: 'object',
        required: ['title', 'description'],
        properties: {
          title: { type: 'string', maxLength: 180 }, description: { type: 'string', maxLength: 12000 },
          category: { type: 'string' }, location: { type: 'string' }, modality: { type: 'string', example: 'Remoto' },
          salary_min: { type: 'number', nullable: true }, salary_max: { type: 'number', nullable: true },
          minimum_experience: { type: 'string' }, contract_type: { type: 'string' }, work_schedule: { type: 'string' },
          openings: { type: 'integer', minimum: 1 }, closing_date: { type: 'string', format: 'date', nullable: true },
          status: { type: 'string', enum: ['active', 'draft', 'closed'] },
        },
      },
      Job: {
        allOf: [ref('JobInput'), {
          type: 'object',
          properties: {
            id: { type: 'integer' }, company_id: { type: 'integer' }, company_name: { type: 'string' },
            company_logo_url: { type: 'string', nullable: true }, created_at: { type: 'string', format: 'date-time' },
            applications_count: { type: 'integer', description: 'Solo en /api/jobs/mine' },
          },
        }],
      },
      ApplicationStatus: { type: 'string', enum: ['sent', 'in_review', 'rejected', 'accepted'] },
      Application: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, job_id: { type: 'integer' }, job_title: { type: 'string' }, company_name: { type: 'string' },
          status: ref('ApplicationStatus'), message: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time' }, cv: ref('File'),
        },
      },
    },
  },
  paths: {
    '/health': { get: { tags: ['Salud'], summary: 'Comprueba el servidor y la conexion a PostgreSQL', responses: { 200: { description: 'Operativo' }, 503: { description: 'Base de datos no disponible' } } } },
    '/api/auth/register': {
      post: {
        tags: ['Autenticacion'], summary: 'Crea una cuenta e inicia sesion',
        requestBody: { required: true, content: json({ type: 'object', required: ['name', 'email', 'password', 'type'], properties: { name: { type: 'string' }, email: { type: 'string', format: 'email' }, password: { type: 'string', example: 'Nova2026' }, type: { type: 'string', enum: ['candidato', 'empresa'] } } }) },
        responses: { 201: { description: 'Cuenta creada', content: json({ type: 'object', properties: { user: ref('User') } }) }, 400: common[400], 409: error('Correo ya registrado'), 429: error('Demasiados intentos') },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Autenticacion'], summary: 'Inicia sesion (crea la cookie nova_session)',
        requestBody: { required: true, content: json({ type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', example: 'empresa@nova.demo' }, password: { type: 'string', example: 'Nova2026' } } }) },
        responses: { 200: { description: 'Sesion iniciada', content: json({ type: 'object', properties: { user: ref('User') } }) }, 400: common[400], 401: error('Credenciales incorrectas'), 429: error('Demasiados intentos') },
      },
    },
    '/api/auth/logout': { post: { tags: ['Autenticacion'], summary: 'Cierra la sesion', responses: { 204: { description: 'Cookie eliminada' } } } },
    '/api/auth/me': { get: { tags: ['Autenticacion'], summary: 'Cuenta de la sesion actual', security: auth, responses: { 200: { description: 'OK', content: json({ type: 'object', properties: { user: ref('User') } }) }, 401: common[401] } } },
    '/api/profile': {
      get: { tags: ['Perfil'], summary: 'Perfil, foto o logo y hoja de vida actuales', security: auth, responses: { 200: { description: 'OK' }, 401: common[401] } },
      put: {
        tags: ['Perfil'], summary: 'Actualiza el perfil (campos segun el rol)', security: auth,
        requestBody: { required: true, content: json({ type: 'object', required: ['name'], properties: { name: { type: 'string' }, phone: { type: 'string' }, title: { type: 'string', description: 'candidato' }, location: { type: 'string', description: 'candidato' }, summary: { type: 'string', description: 'candidato' }, company_name: { type: 'string', description: 'empresa' }, nit: { type: 'string' }, sector: { type: 'string' }, description: { type: 'string' }, website: { type: 'string' } } }) },
        responses: { 200: { description: 'Perfil actualizado' }, 400: common[400], 401: common[401] },
      },
    },
    '/api/jobs': {
      get: { tags: ['Vacantes'], summary: 'Lista vacantes activas (publico)', parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'OK', content: json({ type: 'object', properties: { jobs: { type: 'array', items: ref('Job') } } }) } } },
      post: { tags: ['Vacantes'], summary: 'Crea una vacante (empresa)', security: auth, requestBody: { required: true, content: json(ref('JobInput')) }, responses: { 201: { description: 'Creada', content: json({ type: 'object', properties: { job: ref('Job') } }) }, ...common } },
    },
    '/api/jobs/mine': { get: { tags: ['Vacantes'], summary: 'Vacantes de la empresa con su numero de postulantes', security: auth, responses: { 200: { description: 'OK' }, 401: common[401], 403: common[403] } } },
    '/api/jobs/{id}': {
      parameters: [idParam],
      get: { tags: ['Vacantes'], summary: 'Detalle de una vacante activa', responses: { 200: { description: 'OK' }, 404: error('No existe') } },
      put: { tags: ['Vacantes'], summary: 'Actualiza una vacante propia', security: auth, requestBody: { required: true, content: json(ref('JobInput')) }, responses: { 200: { description: 'OK' }, 404: error('No es tuya o no existe'), ...common } },
      delete: { tags: ['Vacantes'], summary: 'Elimina una vacante propia', security: auth, responses: { 204: { description: 'Eliminada' }, 404: error('No es tuya o no existe'), 401: common[401], 403: common[403] } },
    },
    '/api/jobs/{id}/applications': {
      parameters: [idParam],
      get: { tags: ['Postulaciones'], summary: 'Postulantes de una vacante propia, con su hoja de vida', security: auth, responses: { 200: { description: 'OK' }, 404: error('No es tuya o no existe'), 401: common[401], 403: common[403] } },
    },
    '/api/applications': {
      post: {
        tags: ['Postulaciones'], summary: 'Postularse a una vacante adjuntando la hoja de vida (persistencia dual)', security: auth,
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['job_id'], properties: { job_id: { type: 'integer' }, message: { type: 'string', maxLength: 2000 }, archivo: { type: 'string', format: 'binary', description: 'PDF de hasta 5 MB' }, cv_file_id: { type: 'integer', description: 'Alternativa a archivo: hoja de vida ya guardada en el perfil' } } } } } },
        responses: { 201: { description: 'Postulacion creada', content: json({ type: 'object', properties: { application: ref('Application') } }) }, 404: error('Vacante cerrada o inexistente'), 409: error('Ya postulado'), 413: error('Archivo demasiado grande'), 415: error('Formato no permitido'), ...common },
      },
    },
    '/api/applications/mine': { get: { tags: ['Postulaciones'], summary: 'Historial de postulaciones del candidato', security: auth, responses: { 200: { description: 'OK', content: json({ type: 'object', properties: { applications: { type: 'array', items: ref('Application') } } }) }, 401: common[401], 403: common[403] } } },
    '/api/applications/{id}': { parameters: [idParam], delete: { tags: ['Postulaciones'], summary: 'Retira una postulacion propia (borra tambien su hoja de vida)', security: auth, responses: { 204: { description: 'Retirada' }, 404: error('No existe') } } },
    '/api/applications/{id}/status': {
      parameters: [idParam],
      patch: { tags: ['Postulaciones'], summary: 'Cambia el estado de una postulacion (empresa duena de la vacante)', security: auth, requestBody: { required: true, content: json({ type: 'object', required: ['status'], properties: { status: ref('ApplicationStatus') } }) }, responses: { 200: { description: 'OK' }, 404: error('No existe en tus vacantes'), ...common } },
    },
    '/api/files': {
      post: {
        tags: ['Archivos'], summary: 'Sube la foto o hoja de vida (candidato) o el logo (empresa)', security: auth,
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['tipo', 'archivo'], properties: { tipo: { type: 'string', enum: ['foto_perfil', 'cv', 'logo'] }, archivo: { type: 'string', format: 'binary' } } } } } },
        responses: { 201: { description: 'Guardado en almacenamiento y registrado en la base de datos', content: json({ type: 'object', properties: { file: ref('File') } }) }, 413: error('Archivo demasiado grande'), 415: error('Formato no permitido'), ...common },
      },
    },
    '/api/files/mine': { get: { tags: ['Archivos'], summary: 'Archivos del usuario con sus metadatos', security: auth, responses: { 200: { description: 'OK' }, 401: common[401] } } },
    '/api/files/{id}/download': {
      parameters: [idParam, { name: 'download', in: 'query', schema: { type: 'string', enum: ['1'] }, description: 'Forzar descarga en lugar de abrir' }],
      get: { tags: ['Archivos'], summary: 'Ver o descargar un archivo (Supabase: redirige a una URL firmada de 60 s)', responses: { 200: { description: 'Fichero' }, 302: { description: 'Redireccion a URL firmada' }, 401: common[401], 403: common[403], 404: error('No existe') } },
    },
    '/api/files/{id}': { parameters: [idParam], delete: { tags: ['Archivos'], summary: 'Borra un archivo propio de la base de datos y del almacenamiento', security: auth, responses: { 204: { description: 'Borrado' }, 404: error('No existe'), 409: error('Adjunto a una postulacion') } } },
  },
};
