import { useEffect, useRef, useState, type ReactNode } from "react"
import { Collapsible } from "greyui"

// Inline disclosures keep recent posts in keyboard tab order and avoid a
// floating-positioning dependency for the narrow-screen navigation surface.
export function WindowDisclosure({
  label,
  icon,
  children,
}: {
  label: string
  icon?: ReactNode
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const keyboardOpen = useRef(false)
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
      className={`window-disclosure${icon ? " desktop-disclosure" : ""}`}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if ((event.key === "Escape" || event.key === "ArrowLeft") && open) {
          event.preventDefault()
          event.stopPropagation()
          setOpen(false)
          root.current?.querySelector<HTMLButtonElement>("button")?.focus()
          return
        }
        if (!["ArrowDown", "ArrowUp", "ArrowRight", "Home", "End"].includes(event.key)) return
        event.preventDefault()
        event.stopPropagation()
        if (!open) {
          keyboardOpen.current = true
          setOpen(true)
          return
        }
        const items = [...(root.current?.querySelectorAll<HTMLButtonElement>(".recents-list button") ?? [])]
        const index = items.indexOf(event.target as HTMLButtonElement)
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : (index + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length
        items[next]?.focus()
      }}
    >
      <Collapsible.Trigger className={`recents-trigger${icon ? " desktop-recents-trigger" : ""}`} aria-label={label}>
        {icon}
        <span>{label}</span>
      </Collapsible.Trigger>
      <Collapsible.Panel className="recents-list">
        <div className="menu-heading">{label}</div>
        <nav
          aria-label={label}
          ref={(node) => {
            if (node && keyboardOpen.current) {
              node.querySelector<HTMLButtonElement>("button")?.focus()
              keyboardOpen.current = false
            }
          }}
        >
          {children(() => setOpen(false))}
        </nav>
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}
