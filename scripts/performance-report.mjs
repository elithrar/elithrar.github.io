// Build both revisions first; pass the baseline checkout as the only argument.
// These are byte counts and a CPU microbenchmark, NOT Core Web Vitals scores.
import { readFile, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve, join } from "node:path"
import { pathToFileURL } from "node:url"
import { gzipSync } from "node:zlib"
import { performance } from "node:perf_hooks"
import { build } from "esbuild"

if (!process.argv[2]) throw new Error("Usage: node scripts/performance-report.mjs <built-baseline-checkout>")
const roots = { before: resolve(process.argv[2]), after: process.cwd() }
const temporary = await mkdtemp(join(tmpdir(), "blog-performance-"))
const report = {
  environment: { node: process.version, compression: "gzip, level 9; payload only, not HTTP transfer timing" },
}
try {
  let expectedDates
  for (const [revision, root] of Object.entries(roots)) {
    const catalog = JSON.parse(await readFile(join(root, "_site/desktop-catalog.json"), "utf8"))
    const files = [
      "index.html",
      "desktop-catalog.json",
      "public/desktop/app.js",
      "public/desktop/app.css",
      ...catalog.slice(0, 3).map((post) => `${post.url.slice(1)}index.html`),
    ]
    const assets = {}
    for (const file of files) {
      const bytes = await readFile(join(root, "_site", file))
      assets[file] = { bytes: bytes.length, gzipBytes: gzipSync(bytes, { level: 9 }).length }
    }
    const startupFiles =
      revision === "before"
        ? files
        : files.filter((file) => !file.startsWith("article/") && file !== "desktop-catalog.json")
    const module = join(temporary, `${revision}.mjs`)
    await build({
      entryPoints: [join(root, "desktop/format.ts")],
      outfile: module,
      bundle: true,
      format: "esm",
      platform: "node",
    })
    const { dateLabel } = await import(pathToFileURL(module))
    const dates = Array.from({ length: 2600 }, (_, i) => catalog[i % catalog.length].date)
    const labels = dates.map(dateLabel)
    if (expectedDates && JSON.stringify(labels) !== JSON.stringify(expectedDates))
      throw new Error("Date output changed")
    expectedDates = labels
    const samples = []
    for (let run = 0; run < 3; run++) {
      const start = performance.now()
      dates.forEach(dateLabel)
      samples.push(Number((performance.now() - start).toFixed(2)))
    }
    report[revision] = {
      assets,
      homepageHtmlJsCssAndDataGzipBytes: startupFiles.reduce((sum, file) => sum + assets[file].gzipBytes, 0),
      dateFormatting: {
        callsPerSample: dates.length,
        milliseconds: samples,
        medianMilliseconds: [...samples].sort((a, b) => a - b)[1],
      },
    }
  }
  console.log(JSON.stringify(report, null, 2))
} finally {
  await rm(temporary, { recursive: true, force: true })
}
