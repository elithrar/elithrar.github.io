import { useEffect, useLayoutEffect, useRef, useState, useEffectEvent, type MouseEvent, type PointerEvent } from "react"
import { createRoot } from "react-dom/client"
import { Button, Layer, Window } from "greyui"
import { clampRect, initialRect, type Post, type Rect } from "./catalog"
import { Article } from "./article-viewer"
import { Explorer } from "./archive-explorer"
import { Icon } from "./file-icon"
import { AppIcon } from "./app-icon"
import { useCompactLayout } from "./responsive"
import { WindowDisclosure } from "./window-disclosure"
import "greyui/styles.css"
import "./desktop.css"
import "./nextstep-theme.css"

type AppWindow = { id: string; minimized: boolean; maximized: boolean; rect: Rect }
const ARCHIVE = "archive"
const ABOUT = "about"
function Desktop({ posts }: { posts: Post[] }) {
  const compact = useCompactLayout()
  const [menuOpen, setMenuOpen] = useState(false)
  const [recentMenuOpen, setRecentMenuOpen] = useState(false)
  useEffect(() => {
    if (!menuOpen && compact) setRecentMenuOpen(false)
  }, [menuOpen, compact])
  const menuRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const outside = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    document.addEventListener("pointerdown", outside)
    return () => document.removeEventListener("pointerdown", outside)
  }, [menuOpen])
  const pagePositions = useRef(new Map<string, number>())
  const [viewport, setViewport] = useState({ width: innerWidth - 234, height: innerHeight - 100 })
  const make = (id: string, index: number): AppWindow => ({
    id,
    minimized: false,
    maximized: false,
    rect:
      id === ARCHIVE
        ? clampRect({ x: 160, y: viewport.height * 0.57, width: 700, height: 350 }, viewport.width, viewport.height)
        : id === ABOUT
          ? clampRect({ x: 180, y: 110, width: 390, height: 300 }, viewport.width, viewport.height)
          : initialRect(index, viewport.width, viewport.height),
  })
  const direct = posts.find((post) => post.url === location.pathname)
  const [windows, setWindows] = useState<AppWindow[]>(() =>
    direct
      ? [{ ...make(direct.url, 0), maximized: true }]
      : [...posts.slice(0, 3).map((post, i) => make(post.url, i)), make(ARCHIVE, 0)]
  )
  const [active, setActive] = useState(
    direct?.url ?? (location.pathname === "/archive/" ? ARCHIVE : (posts[0]?.url ?? ARCHIVE))
  )
  const [order, setOrder] = useState<string[]>(() =>
    windows
      .map((win) => win.id)
      .filter((id) => id !== active)
      .concat(active)
  )
  const pendingFocus = useRef<string | null>(null)
  const desktopRef = useRef<HTMLElement>(null)
  const drag = useRef<{
    id: string
    pointer: number
    startX: number
    startY: number
    rect: Rect
    edge?: "left" | "middle" | "right"
  } | null>(null)
  const title = (id: string) =>
    id === ARCHIVE ? "Archive" : id === ABOUT ? "About" : (posts.find((post) => post.url === id)?.title ?? "Article")
  const activate = (id: string, focus = false) => {
    if (compact && id !== active) pagePositions.current.set(active, window.scrollY)
    if (focus) pendingFocus.current = id
    setActive(id)
    setOrder((old) => (old.at(-1) === id ? old : [...old.filter((item) => item !== id), id]))
  }
  const focusWindow = (id: string) => {
    if (active === id) return
    activate(id)
    history.replaceState(null, "", id.startsWith("/") ? id : id === ARCHIVE ? "/archive/" : "/")
  }
  const open = (id: string, navigate = true) => {
    setMenuOpen(false)
    setRecentMenuOpen(false)
    setWindows((old) =>
      old.some((win) => win.id === id)
        ? old.map((win) => (win.id === id ? { ...win, minimized: false } : win))
        : [...old, make(id, old.filter((win) => win.id.startsWith("/")).length % 3)]
    )
    activate(id, true)
    if (navigate) history.pushState(null, "", id === ARCHIVE ? "/archive/" : id === ABOUT ? "/" : id)
  }
  const onNavigate = (event: MouseEvent, path: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
    const url = new URL(path, location.origin)
    if (!posts.some((post) => post.url === url.pathname)) return
    event.preventDefault()
    open(url.pathname, false)
    history.pushState(null, "", url.pathname + url.hash)
    if (url.hash) window.dispatchEvent(new HashChangeEvent("hashchange"))
  }
  useEffect(() => {
    document.body.classList.add("desktop-ready")
    const fallback = document.getElementById("static-blog")
    if (fallback) fallback.inert = true
    return () => {
      document.body.classList.remove("desktop-ready")
      delete document.body.dataset.desktopLayout
      if (fallback) fallback.inert = false
    }
  }, [])
  useLayoutEffect(() => {
    document.body.dataset.desktopLayout = compact ? "compact" : "desktop"
    if (compact) window.scrollTo({ top: pagePositions.current.get(active) ?? 0, behavior: "instant" })
    if (location.hash) {
      const frame = requestAnimationFrame(() => window.dispatchEvent(new HashChangeEvent("hashchange")))
      return () => cancelAnimationFrame(frame)
    }
  }, [compact, active])
  useEffect(() => {
    if (compact) return
    const resize = () => {
      const bounds = desktopRef.current?.getBoundingClientRect()
      const width = bounds?.width ?? innerWidth
      const height = bounds?.height ?? innerHeight - 50
      setViewport({ width, height })
      setWindows((old) => old.map((win) => ({ ...win, rect: clampRect(win.rect, width, height) })))
    }
    const observer = new ResizeObserver(resize)
    if (desktopRef.current) observer.observe(desktopRef.current)
    return () => observer.disconnect()
  }, [compact])
  const onHistoryChange = useEffectEvent(() => {
    const post = posts.find((item) => item.url === location.pathname)
    if (post) open(post.url, false)
    else if (location.pathname === "/archive/") open(ARCHIVE, false)
    else if (posts[0]) open(posts[0].url, false)
  })
  useEffect(() => {
    const pop = () => onHistoryChange()
    window.addEventListener("popstate", pop)
    return () => window.removeEventListener("popstate", pop)
  }, [])
  useEffect(() => {
    const id = pendingFocus.current
    if (!id) return
    const node = [...document.querySelectorAll<HTMLElement>("[data-window-id]")].find(
      (node) => node.dataset.windowId === id
    )
    node?.focus({ preventScroll: true })
    pendingFocus.current = null
  }, [active, windows, order])
  const activeTitle = active ? `${title(active)} · Questionable Services` : "Questionable Services"
  useEffect(() => {
    document.title = activeTitle
  }, [activeTitle])
  const dismiss = (id: string, minimize: boolean) => {
    const remaining = windows.filter((win) => win.id !== id && !win.minimized)
    setWindows((old) =>
      minimize
        ? old.map((win) => (win.id === id ? { ...win, minimized: true } : win))
        : old.filter((win) => win.id !== id)
    )
    const next = [...order].reverse().find((item) => remaining.some((win) => win.id === item))
    if (id !== active) {
      pendingFocus.current = active
    } else if (next) {
      activate(next, true)
      history.replaceState(null, "", next.startsWith("/") ? next : next === ARCHIVE ? "/archive/" : "/")
    } else {
      setActive("")
      history.replaceState(null, "", "/")
      requestAnimationFrame(() => document.getElementById("archive-desktop-launcher")?.focus())
    }
    if (!minimize) {
      pagePositions.current.delete(id)
      setOrder((old) => old.filter((item) => item !== id))
    }
  }
  const reset = () => {
    setWindows((old) => old.map((win, i) => ({ ...make(win.id, i % 3), minimized: win.minimized })))
  }
  const pointerDown = (event: PointerEvent<HTMLElement>, win: AppWindow) => {
    if (event.button !== 0 || compact || win.maximized || (event.target as Element).closest("button")) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      id: win.id,
      pointer: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      rect: win.rect,
    }
  }
  const pointerMove = (event: PointerEvent) => {
    const moving = drag.current
    if (!moving || moving.pointer !== event.pointerId) return
    const dx = event.clientX - moving.startX
    const dy = event.clientY - moving.startY
    const rect = clampRect(
      moving.edge
        ? {
            ...moving.rect,
            x: moving.edge === "left" ? moving.rect.x + Math.min(dx, moving.rect.width - 280) : moving.rect.x,
            width:
              moving.edge === "middle"
                ? moving.rect.width
                : Math.max(280, moving.rect.width + (moving.edge === "left" ? -dx : dx)),
            height: Math.max(200, moving.rect.height + dy),
          }
        : { ...moving.rect, x: moving.rect.x + dx, y: moving.rect.y + dy },
      viewport.width,
      viewport.height
    )
    setWindows((old) => old.map((win) => (win.id === moving.id ? { ...win, rect } : win)))
  }
  const pointerEnd = () => {
    drag.current = null
  }
  const recentItems = (close: () => void) =>
    posts.slice(0, 3).map((post) => (
      <Button
        key={post.url}
        data-current={post.url === active}
        onClick={() => {
          close()
          open(post.url)
        }}
      >
        <span>{post.title}</span>
      </Button>
    ))
  return (
    <Layer.Provider>
      <div className="blog-desktop" data-greyui-theme="nextstep" data-layout={compact ? "compact" : "desktop"}>
        <header
          ref={menuRef}
          className="desktop-bar"
          data-recents-open={recentMenuOpen}
          onBlur={(event) => {
            if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false)
          }}
          onKeyDown={(event) => {
            const keys = ["ArrowDown", "ArrowUp", "Home", "End"]
            if (event.key === "Escape") {
              setMenuOpen(false)
              document.getElementById("menu-toggle")?.focus()
              return
            }
            if (!keys.includes(event.key)) return
            if (compact && !menuOpen) {
              event.preventDefault()
              setMenuOpen(true)
              requestAnimationFrame(() =>
                menuRef.current?.querySelector<HTMLButtonElement>(".recents-trigger")?.focus()
              )
              return
            }
            const items = [
              ...event.currentTarget.querySelectorAll<HTMLElement>(
                ":scope > nav > button:not(:disabled), :scope > nav > a, :scope > nav > .window-disclosure > button"
              ),
            ]
            const index = items.indexOf(event.target as HTMLElement)
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? items.length - 1
                  : (index + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length
            event.preventDefault()
            items[next]?.focus()
          }}
        >
          {compact ? (
            <Button
              id="menu-toggle"
              className="menu-heading"
              aria-expanded={menuOpen}
              aria-controls="desktop-commands"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              Blog <span aria-hidden="true">▾</span>
            </Button>
          ) : (
            <div className="menu-heading">Blog</div>
          )}
          <nav id="desktop-commands" aria-label="Desktop" hidden={compact && !menuOpen}>
            <WindowDisclosure
              label="Recents"
              open={recentMenuOpen}
              onOpenChange={setRecentMenuOpen}
              compactMenu={compact}
            >
              {recentItems}
            </WindowDisclosure>
            <Button id="archive-launcher" onClick={() => open(ARCHIVE)}>
              Archive
            </Button>
            <Button onClick={() => open(ABOUT)}>About</Button>
            {!compact && (
              <>
                <Button
                  disabled={!active}
                  onClick={() =>
                    setWindows((old) =>
                      old.map((win) => (win.id === active ? { ...win, maximized: !win.maximized } : win))
                    )
                  }
                >
                  {windows.find((win) => win.id === active)?.maximized ? "Unzoom" : "Zoom"}
                </Button>
                <Button className="arrange-button" disabled={!windows.some((win) => !win.minimized)} onClick={reset}>
                  Arrange
                </Button>
              </>
            )}
            <a href="/atom.xml">RSS</a>
          </nav>
        </header>
        <nav
          className="desktop-icons"
          aria-label="Desktop apps"
          hidden={compact && windows.some((win) => !win.minimized)}
        >
          <WindowDisclosure label="Recents" icon={<AppIcon app="recents" />}>
            {recentItems}
          </WindowDisclosure>
          <Button id="archive-desktop-launcher" onClick={() => open(ARCHIVE)}>
            <AppIcon app="archive" />
            <span>Archive</span>
          </Button>
          <Button onClick={() => open(ABOUT)}>
            <AppIcon app="about" />
            <span>About</span>
          </Button>
        </nav>
        <nav
          className="miniwindow-tray"
          aria-label="Minimized documents"
          hidden={compact || !windows.some((win) => win.minimized)}
        >
          {windows
            .filter((win) => win.minimized)
            .map((win) => (
              <Button
                key={win.id}
                className="miniwindow"
                aria-label={`Restore ${title(win.id)}`}
                title={title(win.id)}
                onClick={() => open(win.id)}
              >
                <span className="miniwindow-title">{title(win.id)}</span>
                <Icon />
              </Button>
            ))}
        </nav>
        <main className="desktop-workspace" ref={desktopRef} aria-label="Blog desktop">
          {windows.map((win) => {
            const post = posts.find((post) => post.url === win.id)
            const isActive = active === win.id && !win.minimized
            return (
              <Window.Root
                key={win.id}
                chrome="floating"
                active={isActive}
                className={`desktop-window ${win.maximized ? "is-maximized" : ""} ${win.id === ARCHIVE ? "archive-window" : ""}`}
                data-window-id={win.id}
                data-minimized={win.minimized}
                tabIndex={-1}
                role="region"
                aria-label={title(win.id)}
                hidden={win.minimized || (compact && !isActive)}
                style={{
                  left: win.rect.x,
                  top: win.rect.y,
                  width: win.rect.width,
                  height: win.rect.height,
                  zIndex: order.indexOf(win.id) + 1,
                }}
                onPointerDownCapture={(event) => {
                  if (!(event.target as Element).closest(".title-control")) focusWindow(win.id)
                }}
                onFocusCapture={(event) => {
                  if (!(event.target as Element).closest(".title-control")) focusWindow(win.id)
                }}
              >
                <Window.TitleBar
                  onPointerDown={(event) => pointerDown(event, win)}
                  onPointerMove={pointerMove}
                  onPointerUp={pointerEnd}
                  onPointerCancel={pointerEnd}
                  onLostPointerCapture={pointerEnd}
                  onDoubleClick={(event) => {
                    if (!compact && !(event.target as Element).closest("button"))
                      setWindows((old) =>
                        old.map((item) => (item.id === win.id ? { ...item, maximized: !item.maximized } : item))
                      )
                  }}
                >
                  {!compact && (
                    <Window.Widget
                      className="title-control"
                      kind="minimize"
                      label={`Minimize ${title(win.id)}`}
                      onClick={() => dismiss(win.id, true)}
                    />
                  )}
                  <Window.Title>
                    <span>{compact && post ? "Article" : title(win.id)}</span>
                  </Window.Title>
                  <Button
                    className="window-close title-control"
                    aria-label={`Close ${title(win.id)}`}
                    title={`Close ${title(win.id)}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      dismiss(win.id, false)
                    }}
                  >
                    <svg className="close-glyph" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
                      <path fill="#aaa" stroke="#000" d="M.5.5h13v13H.5z" />
                      <path stroke="#fff" d="M1 12V1h11" />
                      <path stroke="#555" d="M2 12h10V2" />
                      <path stroke="#000" strokeWidth="1.2" d="m3 3 8 8M11 3l-8 8" />
                    </svg>
                  </Button>
                </Window.TitleBar>
                <Window.Body>
                  {post ? (
                    <Article post={post} onNavigate={onNavigate} />
                  ) : win.id === ARCHIVE ? (
                    <Explorer posts={posts} onNavigate={onNavigate} />
                  ) : (
                    <div className="document-scroll about-content">
                      <AppIcon app="about" />
                      <h1>Questionable Services</h1>
                      <p>Writings about computing, agents, and the Internet.</p>
                      <p>
                        By <a href="https://github.com/elithrar">Matt Silverlock</a>.
                      </p>
                      <div className="about-links">
                        <a href="/atom.xml">Subscribe via RSS</a>
                        <a href="https://github.com/elithrar/elithrar.github.io">View source</a>
                      </div>
                    </div>
                  )}
                </Window.Body>
                {!compact && !win.maximized && (
                  <div className="window-resize-bar">
                    {(["left", "middle", "right"] as const).map((edge) => (
                      <div
                        key={edge}
                        role="separator"
                        tabIndex={0}
                        aria-label={`Resize ${title(win.id)} ${edge}`}
                        aria-orientation={edge === "middle" ? "horizontal" : "vertical"}
                        aria-valuenow={Math.round(edge === "middle" ? win.rect.height : win.rect.width)}
                        aria-valuemin={edge === "middle" ? 200 : 280}
                        aria-valuemax={Math.round(edge === "middle" ? viewport.height : viewport.width)}
                        onPointerDown={(event) => {
                          if (event.button !== 0) return
                          event.preventDefault()
                          event.currentTarget.setPointerCapture(event.pointerId)
                          drag.current = {
                            id: win.id,
                            pointer: event.pointerId,
                            startX: event.clientX,
                            startY: event.clientY,
                            rect: win.rect,
                            edge,
                          }
                        }}
                        onPointerMove={pointerMove}
                        onPointerUp={pointerEnd}
                        onPointerCancel={pointerEnd}
                        onLostPointerCapture={pointerEnd}
                        onKeyDown={(event) => {
                          if (!event.key.startsWith("Arrow")) return
                          event.preventDefault()
                          const delta = event.shiftKey ? 32 : 8
                          const r = { ...win.rect }
                          if (event.key === "ArrowDown") r.height += delta
                          if (event.key === "ArrowUp") r.height = Math.max(200, r.height - delta)
                          if (edge !== "middle" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
                            const dx = event.key === "ArrowRight" ? delta : -delta
                            r.width = Math.max(280, r.width + (edge === "left" ? -dx : dx))
                            if (edge === "left") r.x += win.rect.width - r.width
                          }
                          setWindows((old) =>
                            old.map((item) =>
                              item.id === win.id
                                ? { ...item, rect: clampRect(r, viewport.width, viewport.height) }
                                : item
                            )
                          )
                        }}
                      />
                    ))}
                  </div>
                )}
              </Window.Root>
            )
          })}
        </main>
      </div>
    </Layer.Provider>
  )
}
async function start() {
  const response = await fetch("/desktop-catalog.json")
  if (!response.ok) return
  const posts: Post[] = await response.json()
  if (
    !Array.isArray(posts) ||
    !posts.every(
      (post) =>
        typeof post.title === "string" &&
        typeof post.url === "string" &&
        post.url.startsWith("/article/") &&
        typeof post.date === "string" &&
        typeof post.words === "number"
    )
  )
    return
  posts.sort((a, b) => b.date.localeCompare(a.date))
  createRoot(document.getElementById("desktop-root")!).render(<Desktop posts={posts} />)
}
void start().catch(() => {
  /* The server-rendered blog remains readable if enhancement fails. */
})
