// Haiku artwork shared with WorkbenchOS; sources and license ship beside assets.
const appIcons = {
  recents: "File_Text.svg",
  archive: "Folder_generic.svg",
  about: "Alert_Info.svg",
} as const

export function AppIcon({ app }: { app: keyof typeof appIcons }) {
  return (
    <img
      className="desktop-app-icon"
      src={`/public/icons/haiku/${appIcons[app]}`}
      width="48"
      height="48"
      alt=""
      draggable={false}
    />
  )
}
