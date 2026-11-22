const multer = require('multer');
const { MAX_FILE_MB } = require('./upload.middleware');

function notFound(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

// Manejador central: todas las respuestas de error tienen la forma { error: "mensaje" }.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `El archivo supera el limite de ${MAX_FILE_MB} MB.` });
    if (err.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ error: 'Envia un solo archivo en el campo "archivo".' });
    return res.status(400).json({ error: 'No se pudo procesar el formulario enviado.' });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo de la peticion no es un JSON valido.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'La peticion es demasiado grande.' });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });

  console.error(`[${req.method} ${req.originalUrl}]`, err);
  return res.status(500).json({ error: 'Ocurrio un error interno. Intenta nuevamente.' });
}

module.exports = { notFound, errorHandler };
