import { defineConfig } from "vitest/config";

/**
 * Local dev / preview: base "./"
 * GitHub Pages project site (https://<user>.github.io/<repo>/): set GITHUB_PAGES=true in CI;
 * GITHUB_REPOSITORY is provided automatically in GitHub Actions (owner/repo).
 */
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base =
  process.env.GITHUB_PAGES === "true" && repoName ? `/${repoName}/` : "./";

export default defineConfig({
  root: ".",
  publicDir: "public",
  base,
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
  },
});
