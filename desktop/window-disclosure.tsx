import { useEffect, useRef, useState, type ReactNode } from "react"
import { Collapsible } from "greyui"

// Inline disclosures keep recent posts in keyboard tab order and avoid a
// floating-positioning dependency for the narrow-screen navigation surface.
export function WindowDisclosure({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener("pointerdown", outside)
    return () => document.removeEventListener("pointerdown", outside)
  }, [open])
  return (
    <Collapsible.Root
      ref={root}
      open={open}
      onOpenChange={setOpen}
      className="window-disclosure"
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault()
          event.stopPropagation()
          setOpen(false)
          root.current?.querySelector<HTMLButtonElement>("button")?.focus()
        }
      }}
    >
      <Collapsible.Trigger className="recents-trigger" aria-label={label}>
        {label}
      </Collapsible.Trigger>
      <Collapsible.Panel className="recents-list">
        <nav aria-label={label}>{children(() => setOpen(false))}</nav>
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}
