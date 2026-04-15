import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Use a standalone Vitest config so we don't pull in the React Router Vite
// plugin (which needs a running app server). Tests only exercise pure
// services under app/services, so no framework bootstrap is required.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["app/**/*.test.ts"],
    globals: false,
    reporters: "default",
  },
});
