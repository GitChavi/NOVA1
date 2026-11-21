const multer = require('multer');

const MAX_FILE_MB = Number(process.env.MAX_FILE_SIZE_MB) || 5;

// El fichero queda en memoria solo mientras se valida y se envia al almacenamiento.
// Limites: un archivo por peticion, tamano maximo y pocos campos de texto.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 1, fields: 10, fieldSize: 16 * 1024 },
});

// Campo de formulario acordado con el frontend: FormData.append('archivo', file)
const singleFile = upload.single('archivo');

module.exports = { singleFile, MAX_FILE_MB };
