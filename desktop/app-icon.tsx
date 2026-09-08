// Original shaded artwork; see public/icons/nextstep/README.md.
const appIcons = { recents: "recents", archive: "archive", about: "about" } as const

export function AppIcon({ app }: { app: keyof typeof appIcons }) {
  return (
    <img
      className="desktop-app-icon"
      src={`/public/icons/nextstep/${appIcons[app]}.svg`}
      width="48"
      height="48"
      alt=""
      draggable={false}
    />
  )
}
