import { useEffect, useRef, useState, type MouseEvent } from "react"
import { Button } from "greyui"
import type { Post } from "./catalog"
import { prepareArticle } from "./article"
import { dateLabel } from "./format"

export function Article({ post, onNavigate }: { post: Post; onNavigate: (event: MouseEvent, url: string) => void }) {
  const prefix = `post-${post.url.replace(/[^a-z0-9]/gi, "-")}-`
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const content = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    setError(false)
    const seed =
      document.querySelector("#static-blog .post-content")?.getAttribute("data-post-url") === post.url
        ? document.querySelector("#static-blog .post-content")
        : null
    const request = seed
      ? Promise.resolve(`<div class="post-content">${seed.innerHTML}</div>`)
      : fetch(post.url, { signal: controller.signal }).then((response) => {
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
  }, [post.url, prefix, attempt])
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
}
