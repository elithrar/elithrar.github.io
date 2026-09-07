import { useState, type MouseEvent } from "react"
import { Button, Input, Window } from "greyui"
import { filterPosts, type Post } from "./catalog"
import { Icon } from "./file-icon"
import { dateLabel } from "./format"

export function Explorer({
  posts,
  onNavigate,
}: {
  posts: Post[]
  onNavigate: (event: MouseEvent, url: string) => void
}) {
  const [query, setQuery] = useState("")
  const [year, setYear] = useState("")
  const results = filterPosts(posts, year, query)
  const years = [...new Set(posts.map((post) => post.year))]
  return (
    <>
      <div className="explorer-toolbar">
        <label htmlFor="archive-search">Find</label>
        <Input
          id="archive-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search post titles"
        />
        <span className="sort-label">Newest first</span>
      </div>
      <div className="explorer-content">
        <nav className="year-folders" aria-label="Archive years">
          <Button aria-pressed={!year} onClick={() => setYear("")}>
            <Icon kind="folder" />
            All posts
          </Button>
          {years.map((value) => (
            <Button key={value} aria-pressed={year === value} onClick={() => setYear(value)}>
              <Icon kind="folder" />
              {value}
            </Button>
          ))}
        </nav>
        <div className="file-scroll" tabIndex={0} aria-label="Blog post files">
          <ul className="file-grid">
            {results.map((post) => (
              <li key={post.url}>
                <a href={post.url} onClick={(event) => onNavigate(event, post.url)}>
                  <Icon />
                  <span className="file-title">{post.title}</span>
                  <time dateTime={post.date}>{dateLabel(post.date)}</time>
                </a>
              </li>
            ))}
          </ul>
          {results.length === 0 && (
            <div className="empty-results">
              <p>No posts found.</p>
              <Button
                onClick={() => {
                  setQuery("")
                  setYear("")
                }}
              >
                Show all posts
              </Button>
            </div>
          )}
        </div>
      </div>
      <Window.StatusBar>
        <Window.StatusBar.Item grow role="status" aria-live="polite">
          {results.length} documents{year ? ` · ${year}` : ""}
        </Window.StatusBar.Item>
        <Window.StatusBar.Item>Newest → oldest</Window.StatusBar.Item>
      </Window.StatusBar>
    </>
  )
}
