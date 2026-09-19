import { Router } from "express";
import { health } from "../controllers/health.controller";

export const healthRoutes = Router();

healthRoutes.get("/health", health);
