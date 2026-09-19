import { Router } from "express";
import { listarCanales } from "../controllers/canales.controller";

export const canalesRoutes = Router();

canalesRoutes.get("/canales", listarCanales);
