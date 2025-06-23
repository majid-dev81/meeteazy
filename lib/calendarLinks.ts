export function generateICSLink({
  title,
  description,
  location,
  startDateTime,
  endDateTime,
}: {
  title: string
  description?: string
  location?: string
  startDateTime: Date
  endDateTime: Date
}) {
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]|\.\d{3}/g, '')
  }

  const icsContent = `
BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN
BEGIN:VEVENT
SUMMARY:${title}
DESCRIPTION:${description || ''}
LOCATION:${location || ''}
DTSTART:${formatDate(startDateTime)}
DTEND:${formatDate(endDateTime)}
END:VEVENT
END:VCALENDAR`.trim()

  const encoded = encodeURIComponent(icsContent)
  const href = `data:text/calendar;charset=utf8,${encoded}`

  return href
}