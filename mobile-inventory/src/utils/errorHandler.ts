/**
 * Centralized User-Friendly Error Sanitizer & Handler for Seznik POS Mobile
 *
 * Strips raw database internals, stack traces, raw HTTP error objects, and technical
 * jargon so users receive clear, actionable, friendly messages with reliable fallbacks.
 */

export function sanitizeErrorMessage(rawError: unknown, fallbackMessage = 'An unexpected error occurred. Please try again.'): string {
  if (!rawError) return fallbackMessage;

  let msg = '';
  if (typeof rawError === 'string') {
    msg = rawError;
  } else if (rawError instanceof Error) {
    msg = rawError.message || '';
  } else if (typeof rawError === 'object' && rawError !== null) {
    const obj = rawError as any;
    msg = obj.error || obj.message || obj.detail || obj.statusText || '';
    if (!msg && obj.code) msg = String(obj.code);
  }

  msg = msg.trim();
  if (!msg) return fallbackMessage;

  const lower = msg.toLowerCase();

  // 1. Connection & Network
  if (
    lower.includes('network request failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('econnrefused') ||
    lower.includes('econnreset') ||
    lower.includes('cannot connect to backend') ||
    lower.includes('enotfound')
  ) {
    return 'Unable to reach the server. Please check your internet connection or Wi-Fi and retry.';
  }

  // 2. Timeouts
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('aborterror')) {
    return 'The request timed out. The server is taking longer than usual, please try again.';
  }

  // 3. Database & Backend Engine Internal Errors
  if (
    lower.includes('mongo') ||
    lower.includes('sql') ||
    lower.includes('syntaxerror') ||
    lower.includes('sequelize') ||
    lower.includes('prisma') ||
    lower.includes('duplicate key') ||
    lower.includes('cast to objectid') ||
    lower.includes('e11000') ||
    lower.includes('validation error') ||
    lower.includes('unhandledrejection') ||
    lower.includes('nullpointer') ||
    lower.includes('call stack') ||
    lower.includes('at eval') ||
    lower.includes('internal server error') ||
    lower.includes('500')
  ) {
    if (lower.includes('duplicate') || lower.includes('e11000')) {
      return 'An item or record with this unique code already exists. Please verify and try another.';
    }
    return 'The server encountered an error processing your request. Please try again or contact support.';
  }

  // 4. Authentication / Sessions
  if (
    lower.includes('jwt') ||
    lower.includes('token expired') ||
    lower.includes('unauthorized') ||
    lower.includes('401')
  ) {
    return 'Your session has expired. Please log in again.';
  }

  if (lower.includes('forbidden') || lower.includes('403')) {
    return 'You do not have permission to perform this action.';
  }

  // 5. Native Printer Errors
  if (lower.includes('usedup_label') || lower.includes('no_label')) {
    return 'Printer ran out of labels. Please insert a new label roll.';
  }
  if (lower.includes('no_paper')) {
    return 'Printer is out of paper. Please insert a paper roll.';
  }
  if (lower.includes('coveropened') || lower.includes('labelcanopend')) {
    return 'Printer cover is open or unlocked. Please close and latch the cover.';
  }
  if (lower.includes('volttoo') || lower.includes('battery')) {
    return 'Printer battery is too low. Please plug in the charger.';
  }
  if (lower.includes('tphtoohot')) {
    return 'Print head is too hot. Please let the printer cool down.';
  }

  // 6. Generic HTTP status strings like "HTTP 404 error"
  if (/^http\s+\d{3}\s+error/i.test(msg)) {
    if (msg.includes('404')) return 'The requested information could not be found.';
    if (msg.includes('502') || msg.includes('503') || msg.includes('504')) {
      return 'Server is temporarily unavailable. Please try again shortly.';
    }
    return fallbackMessage;
  }

  // If message contains sensitive stack or code lines, strip them
  if (msg.includes('\n    at ') || msg.includes('Error: ') || msg.length > 250) {
    const firstLine = msg.split('\n')[0].replace(/^Error:\s*/, '');
    if (firstLine.length > 5 && firstLine.length < 150 && !firstLine.includes('at ')) {
      return firstLine;
    }
    return fallbackMessage;
  }

  return msg;
}
