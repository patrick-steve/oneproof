import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Turbopack restricts module resolution to its `root` directory. We
  // need to reach `../bench/results.json` (the canonical bench output,
  // outside web/). Setting root to the repo root lets the lib/bench.ts
  // import resolve. Without this Turbopack errors with
  // 'Module not found: Can't resolve ../../bench/results.json'.
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
};

export default nextConfig;
