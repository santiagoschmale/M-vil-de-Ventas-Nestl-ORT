// ESLint del monorepo. Recomendados de ESLint y typescript-eslint (lo mismo que
// trae el template de Vite para React + TS). El formato no lo mira ESLint: lo
// resuelve Prettier (eslint-config-prettier apaga las reglas que chocan).
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/",
      "**/dist/",
      "**/build/",
      "packages/db/generated/",
      "apps/excel-service/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Convención: un parámetro que empieza con _ es obligatorio por firma pero
      // no se usa (p. ej. el `next` del error handler de Express).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ["apps/api/**/*.ts", "packages/**/*.ts", "*.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    // Scripts de Node en CommonJS.
    files: ["scripts/**/*.js"],
    languageOptions: { globals: globals.node, sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  prettier,
);
