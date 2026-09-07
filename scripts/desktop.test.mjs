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
async function launch({ path = "/", failCatalog = false, failArticle = false, width = 1440, coarse = false } = {}) {
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
  Object.defineProperty(dom.window, "innerWidth", { value: width, writable: true })
  Object.defineProperty(dom.window, "scrollY", { value: 0, writable: true })
  dom.window.scrollTo = (options) => {
    dom.window.scrollY = options.top ?? 0
  }
  const media = new dom.window.EventTarget()
  media.matches = width <= 960 || coarse
  dom.window.matchMedia = (query) =>
    query === "(max-width: 960px), (pointer: coarse)"
      ? media
      : { matches: false, addEventListener() {}, removeEventListener() {} }
  const resizeViewport = (nextWidth, nextCoarse = false) => {
    dom.window.innerWidth = nextWidth
    media.matches = nextWidth <= 960 || nextCoarse
    media.dispatchEvent(new dom.window.Event("change"))
  }
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
  return { dom, document: dom.window.document, calls, resizeViewport, close: () => dom.window.close() }
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

async function switchWindow(dom, document, name) {
  click(dom, document.querySelector(".windows-trigger"))
  await until(() =>
    [...document.querySelectorAll(".windows-list button")].some((node) => node.textContent.includes(name))
  )
  click(
    dom,
    [...document.querySelectorAll(".windows-list button")].find((node) => node.textContent.includes(name))
  )
}
async function closeWindow(dom, document, name) {
  click(dom, button(document, `Window menu for ${name}`))
  await until(() => document.querySelector(`.window-actions-menu button[aria-label="Close ${name}"]`))
  click(dom, document.querySelector(`.window-actions-menu button[aria-label="Close ${name}"]`))
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
  assert.deepEqual(filterPosts(catalog, ""), catalog)
  assert.equal(filterPosts(catalog, "  " + first.title.toUpperCase() + "  ")[0].url, first.url)
  assert.equal(filterPosts(catalog, "no-such-blog-title-92879").length, 0)
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
    await switchWindow(dom, document, first.title)
    await until(() => !region(document, first.url).hidden)
    assert.equal(firstReader.scrollTop, 300)
    assert.equal(calls.filter((url) => url === first.url).length, 1)
    click(dom, region(document, "archive").querySelector(`a[href="${oldest.url}"]`))
    await until(() => region(document, oldest.url)?.querySelector(".article-content"))
    assert.equal(dom.window.location.pathname, oldest.url)
    click(dom, region(document, "archive").querySelector(`a[href="${oldest.url}"]`))
    await until(() => document.activeElement === region(document, oldest.url))
    assert.equal(document.querySelectorAll("[data-window-id]").length, 5)
    await closeWindow(dom, document, oldest.title)
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

test("compact widths and touch tablets expose one document and one complete newest-first archive", async () => {
  for (const [width, coarse] of [
    [320, false],
    [390, false],
    [540, false],
    [768, false],
    [960, false],
    [1024, true],
  ]) {
    const app = await launch({ width, coarse })
    try {
      const { dom, document } = app
      assert.equal(document.querySelector(".blog-desktop").dataset.layout, "compact")
      assert.equal(document.body.dataset.desktopLayout, "compact")
      assert.equal(document.querySelectorAll("[data-window-id]:not([hidden])").length, 1)
      assert.equal(document.querySelectorAll(".greyui-window-widget").length, 0)
      click(dom, document.getElementById("archive-launcher"))
      await until(() => !region(document, "archive").hidden)
      assert.deepEqual(
        [...region(document, "archive").querySelectorAll(".file-grid a")].map((a) => a.getAttribute("href")),
        catalog.map((p) => p.url)
      )
      assert.equal(region(document, "archive").querySelector("aside"), null)
      await switchWindow(dom, document, first.title)
      await until(() => !region(document, first.url).hidden)
      assert.equal(document.querySelectorAll("[data-window-id]:not([hidden])").length, 1)
    } finally {
      app.close()
    }
  }
})

test("compact switching and browser history restore page positions; mode changes retain readers and desktop geometry", async () => {
  const { dom, document, resizeViewport, close } = await launch()
  try {
    await until(() => region(document, first.url)?.querySelector(".article-content"))
    const firstWindow = region(document, first.url)
    const reader = firstWindow.querySelector(".document-scroll")
    const geometry = firstWindow.getAttribute("style")
    resizeViewport(390)
    await until(() => document.body.dataset.desktopLayout === "compact")
    dom.window.scrollTo({ top: 620 })
    await switchWindow(dom, document, second.title)
    await until(() => !region(document, second.url).hidden)
    assert.equal(dom.window.scrollY, 0)
    dom.window.scrollTo({ top: 310 })
    await switchWindow(dom, document, first.title)
    await until(() => !firstWindow.hidden)
    assert.equal(dom.window.scrollY, 620)
    dom.window.history.back()
    await until(() => !region(document, second.url).hidden)
    assert.equal(dom.window.scrollY, 310)
    await switchWindow(dom, document, first.title)
    await until(() => !firstWindow.hidden)
    resizeViewport(1440)
    await until(() => document.body.dataset.desktopLayout === "desktop")
    assert.equal(firstWindow.querySelector(".document-scroll"), reader)
    assert.equal(firstWindow.getAttribute("style"), geometry)
    assert.equal(document.querySelectorAll("[data-window-id]:not([hidden])").length, 4)
  } finally {
    close()
  }
})

test("window disclosures retain full titles, close on Escape, and recover after closing every compact document", async () => {
  const { dom, document, close } = await launch({ width: 320 })
  try {
    const trigger = document.querySelector(".windows-trigger")
    click(dom, trigger)
    await until(() => trigger.getAttribute("aria-expanded") === "true")
    for (const post of catalog.slice(0, 3))
      assert.ok(document.querySelector(".windows-list").textContent.includes(post.title))
    const item = document.querySelector(".windows-list button")
    item.focus()
    item.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    await until(() => trigger.getAttribute("aria-expanded") === "false")
    assert.equal(document.activeElement, trigger)
    for (const name of [first.title, catalog[2].title, second.title, "Archive"]) {
      await switchWindow(dom, document, name)
      await until(() =>
        [...document.querySelectorAll("[data-window-id]:not([hidden])")].some(
          (node) => node.getAttribute("aria-label") === name
        )
      )
      await closeWindow(dom, document, name)
      await until(
        () =>
          ![...document.querySelectorAll("[data-window-id]")].some((node) => node.getAttribute("aria-label") === name)
      )
    }
    assert.ok(document.querySelector(".closed-workspace"))
    click(dom, button(document, "Open Archive"))
    await until(() => region(document, "archive") && !region(document, "archive").hidden)
    assert.equal(region(document, "archive").querySelectorAll(".file-grid a").length, catalog.length)
  } finally {
    close()
  }
})

test("reference study contains 20 distinct original PNGs with verifiable provenance", async () => {
  const { createHash } = await import("node:crypto")
  const references = JSON.parse(await readFile("docs/references/windows311/screenshots.json", "utf8"))
  assert.equal(references.length, 20)
  assert.equal(new Set(references.map((item) => item.sha256)).size, 20)
  for (const item of references) {
    const bytes = await readFile(`docs/references/windows311/${item.file}`)
    assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256)
    assert.equal(bytes.readUInt32BE(16), 640)
    assert.equal(bytes.readUInt32BE(20), 480)
    assert.ok(item.source.startsWith("https://www.zx.net.nz/"))
  }
})
