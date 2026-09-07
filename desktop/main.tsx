import { useEffect, useLayoutEffect, useRef, useState, useEffectEvent, type MouseEvent, type PointerEvent } from "react"
import { createRoot } from "react-dom/client"
import { Button, Layer, Window } from "greyui"
import { clampRect, initialRect, type Post, type Rect } from "./catalog"
import { Article } from "./article-viewer"
import { Explorer } from "./archive-explorer"
import { Icon } from "./file-icon"
import { useCompactLayout } from "./responsive"
import { WindowDisclosure } from "./window-disclosure"
import "greyui/styles.css"
import "./desktop.css"

type AppWindow = { id: string; minimized: boolean; maximized: boolean; rect: Rect }
const ARCHIVE = "archive"
const ABOUT = "about"
function Desktop({ posts }: { posts: Post[] }) {
  const compact = useCompactLayout()
  const pagePositions = useRef(new Map<string, number>())
  const [viewport, setViewport] = useState({ width: innerWidth, height: innerHeight - 100 })
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
    if (next) {
      activate(next, true)
      history.replaceState(null, "", next.startsWith("/") ? next : next === ARCHIVE ? "/archive/" : "/")
    } else {
      setActive("")
      history.replaceState(null, "", "/")
      document.getElementById("archive-launcher")?.focus()
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
    const rect = clampRect(
      {
        ...moving.rect,
        x: moving.rect.x + event.clientX - moving.startX,
        y: moving.rect.y + event.clientY - moving.startY,
      },
      viewport.width,
      viewport.height
    )
    setWindows((old) => old.map((win) => (win.id === moving.id ? { ...win, rect } : win)))
  }
  const pointerEnd = () => {
    drag.current = null
  }
  return (
    <Layer.Provider>
      <div className="blog-desktop" data-greyui-theme="win311" data-layout={compact ? "compact" : "desktop"}>
        <header className="desktop-bar">
          <a
            className="desktop-brand"
            href="/"
            onClick={(event) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
              event.preventDefault()
              reset()
              if (posts[0]) open(posts[0].url, false)
              history.pushState(null, "", "/")
            }}
          >
            <img src="/public/favicon.svg" width="28" height="28" alt="" />
            <span>Questionable Services</span>
          </a>
          <nav aria-label="Desktop">
            <Button id="archive-launcher" onClick={() => open(ARCHIVE)}>
              Archive
            </Button>
            <WindowDisclosure label="Recents">
              {(close) =>
                posts.slice(0, 3).map((post) => (
                  <Button
                    key={post.url}
                    data-current={post.url === active}
                    onClick={() => {
                      close()
                      open(post.url)
                    }}
                  >
                    <Icon />
                    <span>{post.title}</span>
                  </Button>
                ))
              }
            </WindowDisclosure>
            <Button onClick={() => open(ABOUT)}>About</Button>
            {!compact && (
              <Button className="arrange-button" onClick={reset}>
                Arrange
              </Button>
            )}
            <a href="/atom.xml">RSS</a>
          </nav>
        </header>
        <main className="desktop-workspace" ref={desktopRef} aria-label="Blog desktop">
          {compact && !windows.some((win) => !win.minimized) && (
            <div className="closed-workspace">
              <p>No documents open.</p>
              <Button onClick={() => open(ARCHIVE)}>Open Archive</Button>
            </div>
          )}
          <nav className="desktop-icons" aria-label="Desktop apps">
            <Button onClick={() => open(ARCHIVE)}>
              <Icon kind="folder" />
              <span>Archive</span>
            </Button>
            <Button onClick={() => open(ABOUT)}>
              <Icon kind="about" />
              <span>About</span>
            </Button>
          </nav>
          <div className="desktop-caption" aria-hidden="true">
            Writings about computing,
            <br />
            agents, and the Internet.
          </div>
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
                onPointerDownCapture={() => focusWindow(win.id)}
                onFocusCapture={() => focusWindow(win.id)}
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
                  <Button
                    className="window-close"
                    aria-label={`Close ${title(win.id)}`}
                    title={`Close ${title(win.id)}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      dismiss(win.id, false)
                    }}
                  >
                    <span aria-hidden="true" />
                  </Button>
                  <Window.Title>
                    <span>{compact && post ? "Article" : title(win.id)}</span>
                  </Window.Title>
                  {!compact && (
                    <Window.Controls>
                      <Window.Widget
                        kind="minimize"
                        label={`Minimize ${title(win.id)}`}
                        onClick={() => dismiss(win.id, true)}
                      />
                      <Window.Widget
                        className="maximize-button"
                        kind={win.maximized ? "restore" : "zoom"}
                        label={`${win.maximized ? "Restore" : "Maximize"} ${title(win.id)}`}
                        onClick={() =>
                          setWindows((old) =>
                            old.map((item) => (item.id === win.id ? { ...item, maximized: !item.maximized } : item))
                          )
                        }
                      />
                    </Window.Controls>
                  )}
                </Window.TitleBar>
                <Window.Body>
                  {post ? (
                    <>
                      <div className="document-toolbar">
                        <span>Article</span>
                        <a href={post.url} target="_blank" rel="noopener">
                          Open page ↗
                        </a>
                      </div>
                      <Article post={post} onNavigate={onNavigate} />
                    </>
                  ) : win.id === ARCHIVE ? (
                    <Explorer posts={posts} onNavigate={onNavigate} />
                  ) : (
                    <div className="document-scroll about-content">
                      <img src="/public/favicon.svg" width="64" height="64" alt="" />
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
