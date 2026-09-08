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
  // Subsequence matching supports abbreviated titles while preserving date order.
  const letters = [...term.replace(/\s+/g, "")]
  return posts.filter((post) => {
    const title = post.title.toLocaleLowerCase()
    let position = 0
    return letters.every((letter) => {
      const index = title.indexOf(letter, position)
      position = index + 1
      return index !== -1
    })
  })
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
  const card = Math.min(460, Math.max(340, (width - 32) / 3))
  return clampRect(
    { x: 8 + index * (card - 16), y: 24 + index * 28, width: card, height: Math.max(300, height * 0.64) },
    width,
    height
  )
}
