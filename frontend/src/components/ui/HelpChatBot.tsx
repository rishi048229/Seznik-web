import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { FAQ_DATA, FAQ_CATEGORIES, CHAT_LANGUAGES, type ChatLang, type FaqEntry } from '@/data/chatbotFaq'
import { MessageCircle, X, Send, ChevronLeft, Globe, Bot, User, Sparkles } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string
  role: 'user' | 'bot'
  text: string
  timestamp: Date
  faqId?: number
}

// ─── Fuzzy Match ────────────────────────────────────────────────────────────
const normalise = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim()

function scoreMatch(query: string, entry: FaqEntry, lang: ChatLang): number {
  const q = normalise(query)
  const words = q.split(/\s+/).filter(w => w.length > 1)
  if (words.length === 0) return 0

  let score = 0

  // Keyword hits (high weight)
  for (const kw of entry.keywords) {
    const nkw = normalise(kw)
    if (q.includes(nkw)) score += 10
    for (const w of words) {
      if (nkw.includes(w) || w.includes(nkw)) score += 3
    }
  }

  // Question text match
  const qText = normalise(entry.question[lang] || entry.question.en)
  for (const w of words) {
    if (qText.includes(w)) score += 2
  }

  // English question fallback match
  if (lang !== 'en') {
    const qEn = normalise(entry.question.en)
    for (const w of words) {
      if (qEn.includes(w)) score += 1
    }
  }

  return score
}

function findBestMatches(query: string, lang: ChatLang, limit = 3): FaqEntry[] {
  const scored = FAQ_DATA.map(e => ({ entry: e, score: scoreMatch(query, e, lang) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
  return scored.map(s => s.entry)
}

// ─── Message ID ─────────────────────────────────────────────────────────────
const msgId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

// ─── Greeting messages by language ──────────────────────────────────────────
const GREETINGS: Record<ChatLang, string> = {
  en: "👋 Hi! I'm **Seznik Help Bot**. I can help you with printing, labels, products, sales, and more!\n\nType a question or pick a topic below.",
  hi: "👋 नमस्ते! मैं **Seznik हेल्प बॉट** हूं। मैं प्रिंटिंग, लेबल, उत्पाद, बिक्री और अन्य विषयों में मदद कर सकता हूं!\n\nकोई सवाल टाइप करें या नीचे विषय चुनें।",
  mr: "👋 नमस्कार! मी **Seznik हेल्प बॉट** आहे. मी प्रिंटिंग, लेबल, प्रॉडक्ट, विक्री आणि इतर विषयांमध्ये मदत करू शकतो!\n\nप्रश्न टाइप करा किंवा खालील विषय निवडा.",
  ta: "👋 வணக்கம்! நான் **Seznik உதவி போட்**. அச்சிடுதல், லேபிள்கள், தயாரிப்புகள், விற்பனை மற்றும் பலவற்றில் உதவ முடியும்!\n\nகேள்வி தட்டச்சு செய்யவும் அல்லது கீழே ஒரு தலைப்பைத் தேர்ந்தெடுக்கவும்.",
  te: "👋 నమస్కారం! నేను **Seznik హెల్ప్ బోట్**. ప్రింటింగ్, లేబుల్‌లు, ఉత్పత్తులు, అమ్మకాలు మరియు ఇతర విషయాలలో సహాయం చేయగలను!\n\nప్రశ్న టైప్ చేయండి లేదా కింద ఒక అంశాన్ని ఎంచుకోండి.",
  gu: "👋 નમસ્તે! હું **Seznik હેલ્પ બોટ** છું. હું પ્રિંટિંગ, લેબલ, પ્રોડક્ટ, વેચાણ અને વધુમાં મદદ કરી શકું છું!\n\nપ્રશ્ન ટાઈપ કરો અથવા નીચે વિષય પસંદ કરો.",
}

const NO_RESULT: Record<ChatLang, string> = {
  en: "🤔 I couldn't find an exact answer for that. Try rephrasing or pick a topic from the menu.\n\n💡 *AI-powered answers are coming soon!*",
  hi: "🤔 इसका सटीक उत्तर नहीं मिला। कृपया दोबारा प्रयास करें या मेनू से विषय चुनें।\n\n💡 *AI-संचालित उत्तर जल्द आ रहे हैं!*",
  mr: "🤔 याचे नेमके उत्तर सापडले नाही. कृपया पुन्हा प्रयत्न करा.\n\n💡 *AI-संचालित उत्तरे लवकरच येतील!*",
  ta: "🤔 அதற்கான சரியான பதிலைக் கண்டுபிடிக்க முடியவில்லை.\n\n💡 *AI-இயக்கப்படும் பதில்கள் விரைவில் வரும்!*",
  te: "🤔 దానికి సరైన సమాధానం కనుగొనలేకపోయాను.\n\n💡 *AI-ఆధారిత సమాధానాలు త్వరలో వస్తాయి!*",
  gu: "🤔 તેના માટે ચોક્કસ જવાબ મળ્યો નથી.\n\n💡 *AI-સંચાલિત જવાબો ટૂંક સમયમાં આવશે!*",
}

// ─── Simple markdown-like renderer ──────────────────────────────────────────
function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>')
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export const HelpChatBot = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [lang, setLang] = useState<ChatLang>('en')
  const [showLangPicker, setShowLangPicker] = useState(false)
  const [showCategories, setShowCategories] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>(() => [{
    id: msgId(),
    role: 'bot',
    text: GREETINGS['en'],
    timestamp: new Date(),
  }])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTyping])


  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [isOpen])

  // Get FAQs for a category
  const getCategoryFaqs = useCallback((catId: string) => {
    return FAQ_DATA.filter(f => f.category === catId)
  }, [])

  // Handle sending a message
  const handleSend = useCallback((text?: string) => {
    const query = (text || input).trim()
    if (!query) return

    // Add user message
    const userMsg: ChatMessage = {
      id: msgId(),
      role: 'user',
      text: query,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setShowCategories(false)
    setIsTyping(true)

    // Simulate typing delay for natural feel
    setTimeout(() => {
      const matches = findBestMatches(query, lang)

      if (matches.length > 0) {
        const best = matches[0]
        const answer = best.answer[lang] || best.answer.en
        const botMsg: ChatMessage = {
          id: msgId(),
          role: 'bot',
          text: answer,
          timestamp: new Date(),
          faqId: best.id,
        }
        setMessages(prev => [...prev, botMsg])

        // If there are more related results, show suggestions
        if (matches.length > 1) {
          const suggestionsText = matches.slice(1).map(m =>
            `• ${m.question[lang] || m.question.en}`
          ).join('\n')

          setTimeout(() => {
            setMessages(prev => [...prev, {
              id: msgId(),
              role: 'bot',
              text: `📌 **Related questions:**\n${suggestionsText}`,
              timestamp: new Date(),
            }])
          }, 400)
        }
      } else {
        setMessages(prev => [...prev, {
          id: msgId(),
          role: 'bot',
          text: NO_RESULT[lang],
          timestamp: new Date(),
        }])
      }
      setIsTyping(false)
    }, 600 + Math.random() * 400)
  }, [input, lang])

  // Handle FAQ click from category
  const handleFaqClick = useCallback((faq: FaqEntry) => {
    const question = faq.question[lang] || faq.question.en
    const answer = faq.answer[lang] || faq.answer.en

    setShowCategories(false)
    setMessages(prev => [
      ...prev,
      { id: msgId(), role: 'user', text: question, timestamp: new Date() },
    ])
    setIsTyping(true)

    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { id: msgId(), role: 'bot', text: answer, timestamp: new Date(), faqId: faq.id },
      ])
      setIsTyping(false)
    }, 500)
  }, [lang])

  // Handle language change
  const handleLangChange = useCallback((newLang: ChatLang) => {
    setLang(newLang)
    setShowLangPicker(false)
    // Add system message about language change
    const langLabel = CHAT_LANGUAGES.find(l => l.code === newLang)?.label || newLang
    setMessages(prev => [
      ...prev,
      { id: msgId(), role: 'bot', text: `🌐 Language changed to **${langLabel}**.\n\n${GREETINGS[newLang]}`, timestamp: new Date() },
    ])
  }, [])

  // Category view
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const categoryFaqs = useMemo(() => {
    if (!selectedCategory) return []
    return getCategoryFaqs(selectedCategory)
  }, [selectedCategory, getCategoryFaqs])

  return (
    <>
      {/* ─── Floating Button ─── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 ${
          isOpen
            ? 'bg-gray-700 hover:bg-gray-600 rotate-90'
            : 'bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 animate-pulse'
        }`}
        style={{ animationDuration: isOpen ? '0s' : '2s' }}
        title="Help & Support"
      >
        {isOpen ? <X size={22} className="text-white" /> : <MessageCircle size={22} className="text-white" />}
      </button>

      {/* ─── Chat Window ─── */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-8rem)] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">

          {/* ─── Header ─── */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <Bot size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white">Seznik Help Bot</h3>
              <p className="text-[10px] text-blue-100 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
                Online • {CHAT_LANGUAGES.find(l => l.code === lang)?.label}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowLangPicker(!showLangPicker)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                title="Change Language"
              >
                <Globe size={16} className="text-white" />
              </button>
              <button
                onClick={() => { setShowCategories(true); setSelectedCategory(null) }}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                title="Browse Topics"
              >
                <Sparkles size={16} className="text-white" />
              </button>
            </div>
          </div>

          {/* ─── Language Picker ─── */}
          {showLangPicker && (
            <div className="px-3 py-2 bg-blue-50 dark:bg-gray-800 border-b border-blue-100 dark:border-gray-700 flex flex-wrap gap-1.5">
              {CHAT_LANGUAGES.map(l => (
                <button
                  key={l.code}
                  onClick={() => handleLangChange(l.code)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                    lang === l.code
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-blue-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {l.flag} {l.label}
                </button>
              ))}
            </div>
          )}

          {/* ─── Main Body ─── */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin"
          >
            {/* Category browser */}
            {showCategories && !selectedCategory && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Browse Topics</p>
                <div className="grid grid-cols-2 gap-2">
                  {FAQ_CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className="px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-750 border border-gray-100 dark:border-gray-700 text-left transition-all hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-sm"
                    >
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {cat.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* FAQ list for selected category */}
            {showCategories && selectedCategory && (
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline mb-1"
                >
                  <ChevronLeft size={14} /> Back to Topics
                </button>
                <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-2">
                  {FAQ_CATEGORIES.find(c => c.id === selectedCategory)?.label}
                </p>
                {categoryFaqs.map(faq => (
                  <button
                    key={faq.id}
                    onClick={() => handleFaqClick(faq)}
                    className="w-full text-left px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-750 border border-gray-100 dark:border-gray-700 transition-all hover:border-blue-200 dark:hover:border-blue-800"
                  >
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
                      {faq.question[lang] || faq.question.en}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Chat messages */}
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'bot' && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot size={14} className="text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm border border-gray-200 dark:border-gray-700'
                  }`}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
                />
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User size={14} className="text-gray-600 dark:text-gray-300" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex gap-2 justify-start">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2.5 rounded-2xl rounded-bl-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─── Input Area ─── */}
          <div className="px-3 py-2.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend() }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={lang === 'hi' ? 'अपना सवाल टाइप करें...' : lang === 'mr' ? 'तुमचा प्रश्न टाइप करा...' : lang === 'ta' ? 'உங்கள் கேள்வியை தட்டச்சு செய்யவும்...' : lang === 'te' ? 'మీ ప్రశ్నను టైప్ చేయండి...' : lang === 'gu' ? 'તમારો પ્રશ્ન ટાઈપ કરો...' : 'Type your question...'}
                className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 flex items-center justify-center transition-all disabled:cursor-not-allowed"
              >
                <Send size={14} className="text-white" />
              </button>
            </form>
            <p className="text-center text-[9px] text-gray-400 mt-1.5">
              {lang === 'hi' ? 'AI चैटबॉट जल्द आ रहा है' : lang === 'mr' ? 'AI चॅटबॉट लवकरच येत आहे' : 'AI chatbot coming soon'} • Seznik v2.0
            </p>
          </div>
        </div>
      )}
    </>
  )
}
