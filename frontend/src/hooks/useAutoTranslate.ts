import { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { translateText } from '@/utils/translator'

export function useAutoTranslate(text: string): string {
  const { language } = useLanguage()
  const [translatedText, setTranslatedText] = useState(text)

  useEffect(() => {
    let isMounted = true
    if (!text || language === 'en') {
      setTranslatedText(text)
      return
    }

    translateText(text, language).then(res => {
      if (isMounted) {
        setTranslatedText(res)
      }
    })

    return () => {
      isMounted = false
    }
  }, [text, language])

  return translatedText
}
