import { Router } from "express";
import { canalesRoutes } from "./canales.routes";
import { healthRoutes } from "./health.routes";

export const routes = Router();

// health queda afuera de /api a propósito (lo pegan los checks de
// infraestructura/Docker, no tiene sentido versionarlo bajo /api).
routes.use(healthRoutes);

// Todo lo de negocio va bajo /api. Cuando se defina el mecanismo de
// auth (ver middleware/auth.ts), requireAuth se aplica acá, a este
// router completo, en un solo lugar.
routes.use("/api", canalesRoutes);
