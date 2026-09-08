// Canonical Jekyll HTML is the only source of article bodies.
export function prepareArticle(source: string | Element, url: string, prefix: string): string {
  // Reuse already-parsed server content without touching the static fallback.
  const content =
    typeof source === "string"
      ? new DOMParser().parseFromString(source, "text/html").querySelector(".post-content")
      : (source.cloneNode(true) as Element)
  if (!content) throw new Error("Article content is unavailable")
  const doc = content.ownerDocument
  content.querySelectorAll("script").forEach((node) => node.remove())
  content.querySelectorAll("[id]").forEach((node) => {
    node.id = prefix + node.id
  })
  content.querySelectorAll("a[href], img[src], source[src], video[src], audio[src]").forEach((node) => {
    const attr = node.hasAttribute("href") ? "href" : "src"
    const value = node.getAttribute(attr)!
    const resolved = new URL(value, new URL(url, location.origin))
    node.setAttribute(attr, resolved.href)
  })
  content.querySelectorAll("img").forEach((node, index) => {
    // Do not force a potential first-image LCP candidate to lazy-load.
    if (!node.hasAttribute("loading") && index > 0) node.setAttribute("loading", "lazy")
    node.setAttribute("decoding", "async")
  })
  content.querySelectorAll("pre").forEach((node) => {
    node.tabIndex = 0
    node.setAttribute("aria-label", "Code example")
  })
  content.querySelectorAll("table").forEach((node) => {
    const wrapper = doc.createElement("div")
    wrapper.className = "table-scroll"
    wrapper.tabIndex = 0
    wrapper.setAttribute("role", "region")
    wrapper.setAttribute("aria-label", "Scrollable table")
    node.replaceWith(wrapper)
    wrapper.append(node)
  })
  return content.innerHTML
}
