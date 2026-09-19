import type { NextFunction, Request, Response } from "express";
import { prisma } from "@motor/db";

// Plantilla para el resto de los controllers del motor (objetivos,
// participacion, excepciones, etc): mismo patrón, distinta query.
export async function listarCanales(_req: Request, res: Response, next: NextFunction) {
  try {
    const canales = await prisma.canal.findMany({ orderBy: { nombre: "asc" } });
    res.json(canales);
  } catch (err) {
    next(err);
  }
}
