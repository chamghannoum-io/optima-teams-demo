import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// PUBLIC=1 builds the shareable bundle: pseudonymized people, Pages base path.
const PUBLIC = process.env.PUBLIC === "1";

export default defineConfig({
  // GitHub Pages project sites serve from /<repo>/. Pass PAGES_REPO=<name>;
  // avoid a leading slash in the env value, which Git Bash rewrites to a path.
  base: process.env.PAGES_REPO ? `/${process.env.PAGES_REPO}/` : "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Swap in the pseudonymized data for public builds only.
      ...(PUBLIC
        ? {
            "./people.json": fileURLToPath(new URL("./src/mocks/people.public.json", import.meta.url)),
            "./teams-v2-real.json": fileURLToPath(new URL("./src/mocks/teams-v2-real.public.json", import.meta.url)),
            "./teams-real.json": fileURLToPath(new URL("./src/mocks/teams-real.public.json", import.meta.url)),
          }
        : {}),
      // The vendored components import each other as "@optima/ui".
      "@optima/ui": fileURLToPath(new URL("./src/vendor/ui/index.ts", import.meta.url)),
      "@optima/shared": fileURLToPath(new URL("./src/vendor/app/shared.ts", import.meta.url)),
      "@optima/i18n": fileURLToPath(new URL("./src/vendor/app/shared.ts", import.meta.url)),
      // The real page files import these paths; point them at the vendored copies.
      "@/components/enhanced": fileURLToPath(new URL("./src/vendor/enhanced/index.ts", import.meta.url)),
      "@/__generated__/graphql": fileURLToPath(new URL("./src/vendor/app/generated.ts", import.meta.url)),
      "@/shared/autocomplete/index.js": fileURLToPath(new URL("./src/vendor/app/autocomplete.tsx", import.meta.url)),
      "@/autocompletes/index.js": fileURLToPath(new URL("./src/vendor/app/autocomplete.tsx", import.meta.url)),
      "@optima/auth": fileURLToPath(new URL("./src/vendor/app/auth.tsx", import.meta.url)),
      "react-i18next": fileURLToPath(new URL("./src/vendor/app/i18n.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: { port: 5173 },
});
