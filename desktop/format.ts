const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
export const dateLabel = (date: string) => monthYear.format(new Date(date + "T12:00:00Z"))
