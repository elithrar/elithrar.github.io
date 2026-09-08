import { useEffect, useState } from "react"

export const COMPACT_QUERY = "(max-width: 960px), (pointer: coarse)"

export function useCompactLayout() {
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT_QUERY).matches)
  useEffect(() => {
    const media = window.matchMedia(COMPACT_QUERY)
    const update = () => setCompact(media.matches)
    media.addEventListener("change", update)
    update()
    return () => media.removeEventListener("change", update)
  }, [])
  return compact
}
