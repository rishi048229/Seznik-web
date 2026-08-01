declare global {
  interface Window {
    dataLayer?: Record<string, any>[]
    gtag?: (...args: any[]) => void
    clarity?: (...args: any[]) => void
  }
}

/**
 * Pushes a custom event to Google Tag Manager dataLayer and GA4
 */
export function trackGtmEvent(eventName: string, params: Record<string, any> = {}) {
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: eventName,
      timestamp: new Date().toISOString(),
      ...params,
    })

    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params)
    }
  }
}

/**
 * Identifies the user in Microsoft Clarity session recordings if enabled
 */
export function setClarityUser(userId: string, customProperties: Record<string, any> = {}) {
  if (typeof window !== 'undefined' && typeof window.clarity === 'function') {
    window.clarity('set', 'user_id', userId)
    Object.entries(customProperties).forEach(([key, value]) => {
      if (window.clarity) window.clarity('set', key, String(value))
    })
  }
}

/**
 * Sends a custom action/event to GTM dataLayer, GA4, and Microsoft Clarity
 */
export function trackUserAction(actionName: string, details: Record<string, any> = {}) {
  trackGtmEvent(actionName, details)
  if (typeof window !== 'undefined' && typeof window.clarity === 'function') {
    window.clarity('event', actionName)
  }
}
