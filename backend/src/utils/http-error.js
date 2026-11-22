// Error con codigo HTTP. Los controladores lo lanzan y el manejador central lo responde.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Envuelve un controlador async para que sus errores lleguen al manejador central (Express 4).
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function validId(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0 && Number(value) <= 2147483647;
}

module.exports = { HttpError, asyncHandler, validId };
