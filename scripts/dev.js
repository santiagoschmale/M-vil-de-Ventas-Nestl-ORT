#!/usr/bin/env node
// Un solo comando para levantar todo el entorno local:
// 1. Postgres vía Docker Compose (si no está corriendo).
// 2. Migraciones de Prisma contra esa DB.
// 3. API (Express) y Web (Vite) en paralelo.
//
// Uso: npm run dev  (desde la raíz del monorepo)

const { spawnSync, spawn } = require("node:child_process");

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(`\nFalló: ${cmd} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

console.log("→ Levantando Postgres (docker compose up -d db)...");
run("docker", ["compose", "up", "-d", "db"]);

console.log("→ Esperando a que Postgres esté listo...");
run("docker", [
  "compose",
  "exec",
  "-T",
  "db",
  "sh",
  "-c",
  "until pg_isready -U motor -d motor_distribucion; do sleep 1; done",
]);

console.log("→ Aplicando migraciones de Prisma (packages/db)...");
run("npm", ["run", "generate", "-w", "@motor/db"]);
run("npm", ["run", "migrate:deploy", "-w", "@motor/db"]);

console.log("→ Arrancando API + Web...");
const dev = spawn(
  "npx",
  [
    "concurrently",
    "-n",
    "api,web",
    "-c",
    "blue,green",
    "npm run dev -w @motor/api",
    "npm run dev -w @motor/web",
  ],
  { stdio: "inherit", shell: process.platform === "win32" },
);

dev.on("exit", (code) => process.exit(code ?? 0));
