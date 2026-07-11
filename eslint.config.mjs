import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Frontière RLS de l'API publique : sous /api/v1, on n'appelle jamais
  // createServiceClient() en direct — on passe par orgDb() (lib/api/db.ts) qui
  // filtre chaque requête par organization_id. Empêche une fuite cross-org.
  {
    files: ["app/api/v1/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/server",
              importNames: ["createServiceClient"],
              message:
                "Sous /api/v1, passez par orgDb() (lib/api/db.ts) : chaque requête doit être scopée à organization_id.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
