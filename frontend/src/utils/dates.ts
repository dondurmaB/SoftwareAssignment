import { formatDistanceToNow } from 'date-fns'

export function parseBackendDate(value: string): Date {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const hasTimezone = /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(normalized)
  return new Date(hasTimezone ? normalized : `${normalized}Z`)
}

export function formatRelativeBackendDate(value: string): string {
  return formatDistanceToNow(parseBackendDate(value), { addSuffix: true })
}
