import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { Button, Collapsible } from "greyui"

// Inline disclosures keep recent posts in keyboard tab order and avoid a
// floating-positioning dependency for the narrow-screen navigation surface.
export function WindowDisclosure({
  label,
  icon,
  children,
  open: controlledOpen,
  onOpenChange,
  compactMenu = false,
}: {
  label: string
  icon?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  compactMenu?: boolean
  children: (close: () => void) => ReactNode
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = (next: boolean) => {
    setInternalOpen(next)
    onOpenChange?.(next)
  }
  const returnFocus = useRef(false)
  const closeToTrigger = () => {
    returnFocus.current = true
    setOpen(false)
  }
  useLayoutEffect(() => {
    if (!open && returnFocus.current) {
      root.current?.querySelector<HTMLButtonElement>("button")?.focus()
      returnFocus.current = false
    }
  }, [open])
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
          closeToTrigger()
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
        const items = [...(root.current?.querySelectorAll<HTMLButtonElement>(".recents-list nav button") ?? [])]
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
        <div className="menu-heading">
          {compactMenu && (
            <Button className="palette-back" aria-label="Back to Blog" onClick={closeToTrigger}>
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M8 2 4 6l4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </Button>
          )}
          <span>{label}</span>
        </div>
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
