export interface Post {
  title: string
  url: string
  date: string
  words: number
}
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}
export function filterPosts(posts: Post[], query: string): Post[] {
  const term = query.trim().toLocaleLowerCase()
  return posts.filter((post) => post.title.toLocaleLowerCase().includes(term))
}
export function clampRect(rect: Rect, width: number, height: number): Rect {
  const w = Math.min(rect.width, Math.max(280, width - 16))
  const h = Math.min(rect.height, Math.max(200, height - 16))
  return {
    width: w,
    height: h,
    x: Math.max(8, Math.min(rect.x, width - w - 8)),
    y: Math.max(8, Math.min(rect.y, height - h - 8)),
  }
}
export function initialRect(index: number, width: number, height: number): Rect {
  const card = Math.min(460, Math.max(340, (width - 150) / 3))
  return clampRect(
    { x: 110 + index * (card - 8), y: 24 + index * 28, width: card, height: Math.max(300, height * 0.64) },
    width,
    height
  )
}
