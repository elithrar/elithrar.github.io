import { build } from "esbuild"
await build({
  entryPoints: ["desktop/main.tsx"],
  bundle: true,
  minify: true,
  format: "esm",
  target: ["es2022"],
  outdir: "public/desktop",
  entryNames: "app",
  legalComments: "eof",
  define: { "process.env.NODE_ENV": '"production"' },
})
