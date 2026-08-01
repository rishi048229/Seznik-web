import { useAutoTranslate } from '@/hooks/useAutoTranslate'

interface AutoTranslatedTextProps {
  text: string
  className?: string
  fallback?: string
}

export const AutoTranslatedText = ({ text, className, fallback = '' }: AutoTranslatedTextProps) => {
  const translated = useAutoTranslate(text || fallback)
  return <span className={className}>{translated}</span>
}
