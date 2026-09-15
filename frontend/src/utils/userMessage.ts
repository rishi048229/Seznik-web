import toast from 'react-hot-toast'

const TECHNICAL_RE =
  /prisma|column\s|does not exist|unknown argument|sqlstate|constraint|relation\s|invalid `prisma|p\d{4}\b|econn|etimedout|enotfound|stack trace|internal server|status code|null value|foreign key|unique constraint|available arguments|invocation in|cannot read propert|unexpected token|syntaxerror|typeerror|referenceerror|failed to fetch settings:|failed to (create|update) settings:|json\.parse|json parse error|<html/i

const CANCEL_RE = /notfounderror|user cancelled|user canceled|chooser|requestdevice|the user aborted|aborterror/i

const NETWORK_RE = /failed to fetch|networkerror|load failed|network request failed|timeout|timed out|offline|econnrefused|enotfound/i

export const isCancelledAction = (err: unknown): boolean => {
  if (!err) return false
  const name = err instanceof Error ? err.name : ''
  const message = err instanceof Error ? err.message : String(err)
  return name === 'NotFoundError' || name === 'AbortError' || CANCEL_RE.test(message)
}

const looksTechnical = (message: string): boolean => {
  if (!message.trim()) return true
  if (TECHNICAL_RE.test(message)) return true
  if (message.includes('`') || message.includes('    at ') || message.includes('Error: ')) return true
  if (message.length > 150) return true
  return false
}

export const toUserMessage = (err: unknown, fallback = 'Something went wrong. Please try again.'): string => {
  if (isCancelledAction(err)) {
    return 'Action was cancelled.'
  }

  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : (err as any)?.error || (err as any)?.message || ''

  if (!raw) return fallback

  const lower = raw.toLowerCase()

  if (NETWORK_RE.test(lower)) {
    return 'Unable to reach the server. Please check your internet connection and try again.'
  }

  if (lower.includes('unique constraint') || lower.includes('duplicate') || lower.includes('p2002') || lower.includes('already exists')) {
    if (lower.includes('phone') || lower.includes('mobile')) return 'A record with this phone number already exists.'
    if (lower.includes('email')) return 'An account with this email address already exists.'
    if (lower.includes('code') || lower.includes('barcode')) return 'An item or code with this value already exists.'
    return 'A record with these unique details already exists.'
  }

  if (lower.includes('foreign key') || lower.includes('p2003') || lower.includes('p2014')) {
    return 'Cannot complete this action because this item is linked to existing records or transactions.'
  }

  if (lower.includes('unauthorized') || lower.includes('session expired') || lower.includes('jwt') || lower.includes('401')) {
    return 'Your session has expired. Please sign in again.'
  }

  if (lower.includes('forbidden') || lower.includes('403')) {
    return 'You do not have permission to perform this action.'
  }

  if (looksTechnical(raw)) {
    return fallback
  }

  return raw
}

/** Shows a toast unless the user cancelled (e.g. closed the Bluetooth picker). */
export const toastError = (err: unknown, fallback = 'Something went wrong. Please try again.') => {
  if (isCancelledAction(err)) return
  toast.error(toUserMessage(err, fallback))
}
