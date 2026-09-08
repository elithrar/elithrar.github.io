import { memo, useEffect, useRef, useState, type MouseEvent } from "react"
import { Button } from "greyui"
import type { Post } from "./catalog"
import { prepareArticle } from "./article"
import { dateLabel } from "./format"

function seededArticle(url: string, prefix: string): string | null {
  const seed = [...document.querySelectorAll("#static-blog .post-content[data-post-url]")].find(
    (node) => node.getAttribute("data-post-url") === url
  )
  return seed ? prepareArticle(seed, url, prefix) : null
}

export const Article = memo(function Article({
  post,
  onNavigate,
  visible,
}: {
  post: Post
  onNavigate: (event: MouseEvent, url: string) => void
  visible: boolean
}) {
  const prefix = `post-${post.url.replace(/[^a-z0-9]/gi, "-")}-`
  // Seed before the first commit so an existing article never flashes a loader.
  const [html, setHtml] = useState<string | null>(() => (visible ? seededArticle(post.url, prefix) : null))
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const content = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Retain loaded readers and their scroll positions, but do not load hidden
    // mobile windows until first shown. Closing still unmounts the document.
    if (!visible || html !== null) return
    const controller = new AbortController()
    setError(false)
    const seed = seededArticle(post.url, prefix)
    if (seed !== null) {
      setHtml(seed)
      return
    }
    const request = fetch(post.url, { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error("Article request failed")
      return response.text()
    })
    request
      .then((source) => {
        if (!controller.signal.aborted) setHtml(prepareArticle(source, post.url, prefix))
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
    return () => controller.abort()
  }, [post.url, prefix, attempt, visible, html])
  useEffect(() => {
    if (!html) return
    const jump = () => {
      if (location.pathname !== post.url || !location.hash) return
      let hash: string
      try {
        hash = decodeURIComponent(location.hash.slice(1))
      } catch {
        return
      }
      const target = document.getElementById(prefix + hash)
      if (target && content.current?.contains(target)) target.scrollIntoView({ block: "start" })
    }
    jump()
    window.addEventListener("hashchange", jump)
    window.addEventListener("popstate", jump)
    return () => {
      window.removeEventListener("hashchange", jump)
      window.removeEventListener("popstate", jump)
    }
  }, [html, post.url, prefix])
  return (
    <div className="document-scroll" tabIndex={0} aria-label={`Read ${post.title}`} ref={content}>
      <article className="reader">
        <div className="document-meta">
          <time dateTime={post.date}>{dateLabel(post.date)}</time>
          <span>{Math.max(1, Math.ceil(post.words / 220))} min read</span>
        </div>
        <h1>{post.title}</h1>
        {error ? (
          <div role="alert">
            <p>This article could not be loaded.</p>
            <Button onClick={() => setAttempt(attempt + 1)}>Try again</Button> <a href={post.url}>Open article page</a>
          </div>
        ) : html === null ? (
          <p role="status">Loading article…</p>
        ) : (
          <div
            className="article-content"
            onClick={(event) => {
              const anchor = (event.target as Element).closest("a")
              if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return
              const url = new URL(anchor.href)
              if (url.origin !== location.origin) return
              if (
                url.pathname === post.url &&
                url.hash &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey
              ) {
                let hash: string
                try {
                  hash = decodeURIComponent(url.hash.slice(1))
                } catch {
                  return
                }
                const target = document.getElementById(prefix + hash)
                if (target && content.current?.contains(target)) {
                  event.preventDefault()
                  history.pushState(null, "", post.url + url.hash)
                  target.scrollIntoView({ block: "start" })
                }
              } else onNavigate(event, url.pathname + url.hash)
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </article>
    </div>
  )
})
