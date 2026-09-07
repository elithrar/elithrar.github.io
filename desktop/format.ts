export const dateLabel = (date: string) =>
  new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
