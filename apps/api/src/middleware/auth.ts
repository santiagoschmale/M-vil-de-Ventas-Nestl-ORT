import type { NextFunction, Request, Response } from "express";

// PLACEHOLDER — todavía no está definido el mecanismo de auth real
// (¿SSO corporativo de Nestlé, API key entre servicios, JWT propio?
// depende de lo que confirme Martín). Por ahora este middleware
// NO se aplica a ninguna ruta (ver routes/index.ts): existe para que
// el punto de enganche ya esté ubicado en la capa correcta y no haya
// que reordenar nada cuando se decida el mecanismo.
export function requireAuth(_req: Request, _res: Response, next: NextFunction) {
  // TODO: validar credencial real acá antes de habilitar este middleware.
  next();
}
