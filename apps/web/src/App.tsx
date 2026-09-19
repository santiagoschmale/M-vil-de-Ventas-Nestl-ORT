import { useEffect, useState } from "react";
import type { Canal } from "@motor/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export default function App() {
  const [canales, setCanales] = useState<Canal[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/canales`)
      .then((r) => r.json())
      .then(setCanales)
      .catch(() => setError("No se pudo conectar con la API"));
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Motor del Móvil de Ventas</h1>
      <p>Canales cargados desde la API (Postgres vía Prisma):</p>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <ul>
        {canales.map((c) => (
          <li key={c.canal_id}>{c.nombre}</li>
        ))}
      </ul>
    </main>
  );
}
