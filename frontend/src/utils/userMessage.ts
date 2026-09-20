import toast from 'react-hot-toast'

const TECHNICAL_RE =
  /prisma|column\s|does not exist|unknown argument|sqlstate|constraint|relation\s|invalid `prisma|p\d{4}\b|econn|etimedout|enotfound|stack trace|internal server|status code|null value|foreign key|unique constraint|available arguments|invocation in|cannot read propert|unexpected token|syntaxerror|typeerror|referenceerror|failed to fetch settings:|failed to (create|update) settings:/i

const CANCEL_RE = /notfounderror|user cancelled|user canceled|chooser|requestdevice|the user aborted|aborterror/i

const NETWORK_RE = /failed to fetch|networkerror|load failed|network request failed|timeout|timed out|offline/i

export const isCancelledAction = (err: unknown): boolean => {
  if (!err) return false
  const name = err instanceof Error ? err.name : ''
  const message = err instanceof Error ? err.message : String(err)
  return name === 'NotFoundError' || name === 'AbortError' || CANCEL_RE.test(message)
}

const looksTechnical = (message: string): boolean => {
  if (!message.trim()) return true
  if (TECHNICAL_RE.test(message)) return true
  if (message.includes('`') || message.includes('    at ')) return true
  if (message.length > 140) return true
  return false
}

export const toUserMessage = (err: unknown, fallback = 'Something went wrong. Please try again.'): string => {
  if (isCancelledAction(err)) {
    return 'Printer pairing was cancelled.'
  }

  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : ''

  if (!raw) return fallback

  if (NETWORK_RE.test(raw)) {
    return 'Check your internet connection and try again.'
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
