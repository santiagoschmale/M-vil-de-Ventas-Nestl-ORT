import cors from "cors";
import express from "express";
import { errorHandler } from "./middleware/errorHandler";
import { rateLimiter, seguridadHeaders } from "./middleware/security";
import { routes } from "./routes";

export const app = express();

app.use(seguridadHeaders);
app.use(rateLimiter);
app.use(cors());
app.use(express.json());

app.use(routes);

// Va al final: Express solo lo trata como error handler si tiene 4 args.
app.use(errorHandler);
