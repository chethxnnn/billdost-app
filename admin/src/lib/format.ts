/** Display formatting for the portal: Indian numbering, calm dates. */

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const inrExact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatINR(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : value ?? 0
  return inr.format(Number.isFinite(n as number) ? (n as number) : 0)
}

export function formatMoneyExact(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : value ?? 0
  return inrExact.format(Number.isFinite(n as number) ? (n as number) : 0)
}

export function formatCount(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-IN').format(value ?? 0)
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return 'Never'
  const d = new Date(value)
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return 'Never'
  const d = new Date(value)
  return (
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
    ', ' +
    d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  )
}

export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return 'never'
  const then = new Date(value).getTime()
  const diff = Date.now() - then
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(value)
}

/** WhatsApp deep link for an Indian mobile number, digits only. */
export function whatsappLink(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  const withCountry = digits.length === 10 ? `91${digits}` : digits
  return `https://wa.me/${withCountry}`
}

export function telLink(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  return `tel:+91${digits.slice(-10)}`
}

/** Mask a buyer phone for non-founder roles: 98XXXXXX10 style. */
export function maskPhone(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length < 4) return digits ? 'XXXX' : ''
  return `${digits.slice(0, 2)}XXXXXX${digits.slice(-2)}`
}
