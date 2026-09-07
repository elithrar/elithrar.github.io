import { test } from "node:test"
import assert from "node:assert/strict"
import { readFile, mkdtemp, rm, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { build } from "esbuild"
import { JSDOM } from "jsdom"

const temp = await mkdtemp(join(tmpdir(), "blog-desktop-"))
await build({
  entryPoints: ["desktop/main.tsx"],
  bundle: true,
  format: "iife",
  outfile: join(temp, "app.js"),
  define: { "process.env.NODE_ENV": '"production"' },
})
const script = await readFile(join(temp, "app.js"), "utf8")
await build({ entryPoints: ["desktop/catalog.ts"], bundle: true, format: "esm", outfile: join(temp, "catalog.mjs") })
const { filterPosts, clampRect, initialRect } = await import(join(temp, "catalog.mjs"))
const catalog = JSON.parse(await readFile("_site/desktop-catalog.json", "utf8"))
const first = catalog[0],
  second = catalog[1],
  oldest = catalog.at(-1)
const bodies = new Map(
  await Promise.all(
    [first, second, catalog[2], oldest].map(async (post) => [
      post.url,
      await readFile(`_site${post.url}index.html`, "utf8"),
    ])
  )
)
async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (check()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.ok(check(), "UI did not reach expected state")
}
async function launch({ path = "/", failCatalog = false, failArticle = false } = {}) {
  const calls = []
  const page =
    path === "/"
      ? '<div id="static-blog"><a href="/archive/">Archive</a></div>'
      : `<div id="static-blog">${bodies.get(path)}</div>`
  const dom = new JSDOM(`<div id="desktop-root"></div>${page}`, {
    url: `https://blog.questionable.services${path}`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  })
  dom.window.ResizeObserver = class {
    observe() {}
    disconnect() {}
  }
  dom.window.HTMLElement.prototype.scrollIntoView = function () {
    this.dataset.scrolled = "true"
  }
  dom.window.fetch = async (url) => {
    calls.push(url)
    if (url === "/desktop-catalog.json") return { ok: !failCatalog, json: async () => catalog }
    return { ok: !failArticle && bodies.has(url), text: async () => bodies.get(url) }
  }
  dom.window.eval(script)
  if (!failCatalog) await until(() => dom.window.document.body.classList.contains("desktop-ready"))
  return { dom, document: dom.window.document, calls, close: () => dom.window.close() }
}
function region(document, id) {
  return [...document.querySelectorAll("[data-window-id]")].find((node) => node.dataset.windowId === id)
}
function click(dom, element, options = {}) {
  assert.ok(element, "Expected a clickable control")
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, ...options }))
}
function button(document, name) {
  return [...document.querySelectorAll("button")].find(
    (node) => node.getAttribute("aria-label") === name || node.textContent === name
  )
}

test("generated catalog includes every published article, sorted newest-first with valid canonical output", async () => {
  assert.equal(catalog.length, (await readdir("_posts")).filter((name) => name.endsWith(".md")).length)
  assert.equal(new Set(catalog.map((post) => post.url)).size, catalog.length)
  for (const [i, post] of catalog.entries()) {
    if (i) assert.ok(catalog[i - 1].date >= post.date)
    const html = await readFile(`_site${post.url}index.html`, "utf8")
    assert.ok(html.includes('class="post-content"'))
    assert.ok(html.includes(`rel="canonical" href="https://blog.questionable.services${post.url}"`))
  }
})
test("archive filtering retains descending chronology and handles no matches", () => {
  const results = filterPosts(catalog, oldest.year, "")
  assert.ok(results.every((post) => post.year === oldest.year))
  assert.ok(results.some((post) => post.url === oldest.url))
  assert.equal(filterPosts(catalog, "", "  " + first.title.toUpperCase() + "  ")[0].url, first.url)
  assert.equal(filterPosts(catalog, "", "no-such-blog-title-92879").length, 0)
})
test("window geometry preserves newest left-to-right order and keeps controls reachable after shrinking", () => {
  const rects = [0, 1, 2].map((i) => initialRect(i, 1440, 800))
  assert.ok(rects[0].x < rects[1].x && rects[1].x < rects[2].x)
  for (const width of [320, 390, 768, 1024, 1440]) {
    const rect = clampRect({ x: 1600, y: 1200, width: 700, height: 800 }, width, 600)
    assert.ok(rect.x >= 0 && rect.y >= 0)
    assert.ok(rect.x + rect.width <= width && rect.y + rect.height <= 600)
  }
})
test("three recent windows, archive navigation, deduplication, minimize/restore and focus return", async () => {
  const { dom, document, calls, close } = await launch()
  try {
    await until(() => document.querySelectorAll(".article-content").length === 3)
    assert.deepEqual(
      [...document.querySelectorAll("[data-window-id]")].map((node) => node.dataset.windowId),
      [first.url, second.url, catalog[2].url, "archive"]
    )
    const firstReader = region(document, first.url).querySelector(".document-scroll")
    firstReader.scrollTop = 300
    click(dom, button(document, `Minimize ${first.title}`))
    await until(() => region(document, first.url).hidden)
    click(
      dom,
      [...document.querySelectorAll(".desktop-taskbar button")].find((node) => node.title === first.title)
    )
    await until(() => !region(document, first.url).hidden)
    assert.equal(firstReader.scrollTop, 300)
    assert.equal(calls.filter((url) => url === first.url).length, 1)
    click(dom, region(document, "archive").querySelector(`a[href="${oldest.url}"]`))
    await until(() => region(document, oldest.url)?.querySelector(".article-content"))
    assert.equal(dom.window.location.pathname, oldest.url)
    click(dom, region(document, "archive").querySelector(`a[href="${oldest.url}"]`))
    await until(() => document.activeElement === region(document, oldest.url))
    assert.equal(document.querySelectorAll("[data-window-id]").length, 5)
    click(dom, button(document, `Close ${oldest.title}`))
    await until(() => !region(document, oldest.url))
    assert.ok(document.activeElement.matches("[data-window-id]"))
    dom.window.history.back()
    await until(() => region(document, oldest.url))
  } finally {
    close()
  }
})
test("a cold permalink uses its static body; opening another article never reuses that body", async () => {
  const { dom, document, calls, close } = await launch({ path: first.url })
  try {
    await until(() => document.querySelector(".article-content"))
    assert.equal(calls.filter((url) => url === first.url).length, 0)
    click(dom, document.getElementById("archive-launcher"))
    await until(() => region(document, "archive"))
    click(dom, region(document, "archive").querySelector(`a[href="${second.url}"]`))
    await until(() => region(document, second.url)?.querySelector(".article-content"))
    assert.equal(calls.filter((url) => url === second.url).length, 1)
    assert.notEqual(
      region(document, first.url).querySelector(".article-content").textContent,
      region(document, second.url).querySelector(".article-content").textContent
    )
    const ids = [...document.querySelectorAll("#desktop-root [id]")].map((node) => node.id)
    assert.equal(new Set(ids).size, ids.length)
  } finally {
    close()
  }
})
test("failed enhancement leaves the original blog visible; failed articles offer retry and a canonical link", async () => {
  const failed = await launch({ failCatalog: true })
  try {
    await new Promise((resolve) => setTimeout(resolve, 30))
    assert.equal(failed.document.body.classList.contains("desktop-ready"), false)
  } finally {
    failed.close()
  }
  const article = await launch({ failArticle: true })
  try {
    await until(() => article.document.querySelectorAll('[role="alert"]').length === 3)
    assert.ok(region(article.document, first.url).querySelector(`a[href="${first.url}"]`))
    click(article.dom, region(article.document, first.url).querySelector('[role="alert"] button'))
    await until(() => article.calls.filter((url) => url === first.url).length === 2)
  } finally {
    article.close()
  }
})
process.on("exit", () => {
  void rm(temp, { recursive: true, force: true })
})

test("article anchors target their own window; maximize keeps the same reader and scroll state", async () => {
  const { dom, document, close } = await launch()
  try {
    await until(() => region(document, first.url)?.querySelector(".article-content"))
    const reader = region(document, first.url).querySelector(".document-scroll")
    reader.scrollTop = 200
    click(dom, button(document, `Maximize ${first.title}`))
    await until(() => region(document, first.url).classList.contains("is-maximized"))
    assert.equal(region(document, first.url).querySelector(".document-scroll"), reader)
    assert.equal(reader.scrollTop, 200)
    click(dom, button(document, `Restore ${first.title}`))
    await until(() => !region(document, first.url).classList.contains("is-maximized"))
    const anchor = [...reader.querySelectorAll(".article-content a")].find(
      (node) => new URL(node.href).pathname === first.url && new URL(node.href).hash
    )
    assert.ok(anchor, "Expected a real in-article anchor in the latest post")
    click(dom, anchor)
    assert.equal(dom.window.location.hash, new URL(anchor.href).hash)
    assert.ok(reader.querySelector('[data-scrolled="true"]'))
  } finally {
    close()
  }
})

test("generated public output contains feed and desktop assets without source code or tooling", async () => {
  const output = await readdir("_site")
  for (const name of [
    "desktop",
    "scripts",
    "docs",
    "node_modules",
    "src",
    "package.json",
    "package-lock.json",
    "vite.config.mjs",
  ])
    assert.ok(!output.includes(name), `${name} must not be published`)
  const feed = await readFile("_site/atom.xml", "utf8")
  assert.ok(feed.includes("<feed"))
  assert.ok(feed.includes(first.title))
  for (const file of ["public/desktop/app.js", "public/desktop/app.css", "public/favicon.svg"])
    assert.ok((await readFile(`_site/${file}`)).length > 0)
})
