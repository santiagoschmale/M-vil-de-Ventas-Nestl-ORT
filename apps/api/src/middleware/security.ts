import rateLimit from "express-rate-limit";
import helmet from "helmet";

// Headers de seguridad estándar (X-Content-Type-Options, HSTS, etc).
export const seguridadHeaders = helmet();

// Tope general de requests por IP — corta abuso/fuerza bruta básico.
// Los límites por endpoint más sensible (ej: importar Excel) se
// ajustan aparte si hace falta, esto es el piso general de la API.
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
