import type { NextFunction, Request, Response } from "express";

// Handler centralizado: cualquier error que llegue acá (sync lanzado
// o pasado con next(err)) devuelve una respuesta uniforme y nunca
// filtra el stack trace al cliente.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
}
