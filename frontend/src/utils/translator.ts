/**
 * Utility to auto-translate dynamic text (such as product names or descriptions)
 * into the user's preferred application language.
 */

const translationCache = new Map<string, string>()

export async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text || !targetLang || targetLang === 'en') return text
  const trimmed = text.trim()
  if (!trimmed) return text

  const cacheKey = `${targetLang}:${trimmed}`
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(trimmed)}`
    const res = await fetch(url)
    if (!res.ok) return text
    const data = await res.json()
    if (data && data[0] && Array.isArray(data[0])) {
      const translated = data[0].map((chunk: any) => chunk[0]).join('')
      if (translated) {
        translationCache.set(cacheKey, translated)
        return translated
      }
    }
  } catch (err) {
    console.warn('Auto-translation failed for:', trimmed, err)
  }

  return text
}
