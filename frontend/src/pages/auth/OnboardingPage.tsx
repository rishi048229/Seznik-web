import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { Spinner } from '@/components/ui/Spinner'
import { ImageUpload } from '@/components/forms/ImageUpload'
import { ROUTES } from '@/constants/routes'
import {
  BUSINESS_TEMPLATES,
  BUSINESS_TYPE_OPTIONS,
  type BusinessType,
} from '@/constants/businessTypes'
import { LANGUAGES, type LanguageCode } from '@/i18n/translations'

export const OnboardingPage = () => {
  const { userProfile, completeOnboarding, updateBusinessType } = useAuth()
  const { language, setLanguage } = useLanguage()
  const navigate = useNavigate()

  const pickTypeOnly = userProfile?.onboardingCompleted === true && !userProfile?.businessType

  const [step, setStep] = useState<1 | 2>(1)
  const [businessName, setBusinessName] = useState(userProfile?.businessName ?? '')
  const [phone, setPhone] = useState(userProfile?.phone ?? '')
  const [businessAddress, setBusinessAddress] = useState('')
  const [selectedBusinessType, setSelectedBusinessType] = useState<BusinessType>(
    userProfile?.businessType ?? 'retail_shop'
  )
  const [logoUrl, setLogoUrl] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(language)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const template = BUSINESS_TEMPLATES[selectedBusinessType]
  const selectedLabel =
    BUSINESS_TYPE_OPTIONS.find(option => option.id === selectedBusinessType)?.label ?? 'workspace'

  const validateShopDetails = () => {
    if (!businessName.trim()) {
      setError('Shop name is required.')
      return false
    }
    if (!phone.trim()) {
      setError('Phone number is required.')
      return false
    }
    if (!businessAddress.trim()) {
      setError('Shop address is required.')
      return false
    }
    return true
  }

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (step === 1) {
      if (!pickTypeOnly && !validateShopDetails()) return
      setStep(2)
      return
    }

    setIsSaving(true)
    try {
      setLanguage(selectedLanguage)
      if (pickTypeOnly) {
        await updateBusinessType(selectedBusinessType)
      } else {
        await completeOnboarding({
          businessName: businessName.trim(),
          businessType: selectedBusinessType,
          phone: phone.trim(),
          businessAddress: businessAddress.trim(),
          ...(logoUrl.trim() ? { businessLogoURL: logoUrl.trim() } : {}),
        })
      }
      navigate(ROUTES.ACCESS_SELECTION)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your business profile.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 overflow-x-hidden">
      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#1e1b4b]/10 blur-[120px] rounded-full -z-10" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/5 blur-[100px] rounded-full -z-10" />

      <div className="w-full max-w-4xl grid md:grid-cols-12 overflow-hidden bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
        <section className="hidden md:flex md:col-span-5 bg-gradient-to-br from-[#070235] to-[#3d3dcb] relative p-12 flex-col justify-between overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <img src="/seznik_logo.png" alt="Seznik Logo" className="w-10 h-10 object-contain" />
              <img src="/seznik_logo.png" alt="Seznik" className="w-12 h-auto object-contain" />
            </div>
            <h2 className="text-3xl font-extrabold text-white leading-tight mb-4">
              A workspace that
              <br />
              matches how you sell.
            </h2>
            <p className="text-white/80 text-sm leading-relaxed max-w-xs">
              Restaurants get kitchen tickets and table billing. Retail and online stores get a
              general POS without kitchen tools. Multi-store stays available for everyone.
            </p>
          </div>

          <div className="relative mt-12 z-10">
            <div className="aspect-square w-full rounded-2xl bg-white/10 border border-white/10 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-t from-[#070235]/80 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#39b8fd]" />
                  <span className="text-[10px] uppercase tracking-widest text-white/60 font-bold">
                    Personalized setup
                  </span>
                </div>
                <p className="text-white font-semibold italic text-sm">
                  Choose your business type and we will tailor the dashboard around it.
                </p>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-[#1e1b4b] rounded-full blur-3xl opacity-20" />
        </section>

        <section className="col-span-12 md:col-span-7 p-6 sm:p-10 md:p-16 flex flex-col justify-center max-h-[90vh] overflow-y-auto">
          <nav className="flex items-center gap-4 mb-8 sm:mb-10">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 1
                    ? 'bg-[#070235] text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                1
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {pickTypeOnly ? 'Business type' : 'Shop details'}
              </span>
            </div>
            <div className="w-8 h-px bg-gray-300 dark:bg-gray-600" />
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 2
                    ? 'bg-[#070235] text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                2
              </div>
              <span
                className={`text-sm font-medium ${
                  step === 2 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'
                }`}
              >
                Workspace
              </span>
            </div>
          </nav>

          <header className="mb-6">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {step === 1
                ? pickTypeOnly
                  ? 'What type of business do you run?'
                  : 'Enter your shop details'
                : `Your ${selectedLabel} setup`}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {step === 1
                ? pickTypeOnly
                  ? 'We will tailor your dashboard to kitchen service or general retail.'
                  : 'This information appears on receipts and personalizes your workspace.'
                : 'Confirm this workspace. You can change business type later if needed.'}
            </p>
          </header>

          <form onSubmit={handleNext} className="space-y-5">
            {step === 1 && !pickTypeOnly ? (
              <>
                <Field label="Name of shop *">
                  <input
                    type="text"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    placeholder="e.g. Seznik Cafe"
                    autoFocus
                    className={fieldClass}
                  />
                </Field>
                <Field label="Shop logo">
                  <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
                    Optional — skip if you want to add it later.
                  </p>
                  <ImageUpload
                    value={logoUrl}
                    onChange={setLogoUrl}
                    previewSize="md"
                    accept="image/png,image/jpeg,image/jpg"
                    maxSizeMB={5}
                  />
                </Field>
                <Field label="Phone number *">
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className={fieldClass}
                  />
                </Field>
                <Field label="Shop address *">
                  <textarea
                    value={businessAddress}
                    onChange={e => setBusinessAddress(e.target.value)}
                    placeholder="Street, area, city"
                    rows={3}
                    className={`${fieldClass} resize-none`}
                  />
                </Field>
              </>
            ) : null}

            {step === 1 ? (
              <>
              <Field label={pickTypeOnly ? undefined : 'Type of business *'}>
                <div className="space-y-2">
                  {BUSINESS_TYPE_OPTIONS.map(option => {
                    const selected = selectedBusinessType === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedBusinessType(option.id)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                          selected
                            ? 'border-[#070235] bg-[#070235]/5 dark:bg-[#070235]/10'
                            : 'border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        <span className="text-2xl">{option.emoji}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {option.label}
                          </span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {option.description}
                          </span>
                        </span>
                        {selected ? <Check size={16} className="text-[#070235] shrink-0" /> : null}
                      </button>
                    )
                  })}
                </div>
              </Field>
              <Field label="App language">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {LANGUAGES.map(lang => {
                    const selected = selectedLanguage === lang.code
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          setSelectedLanguage(lang.code)
                          setLanguage(lang.code)
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-between ${
                          selected
                            ? 'border-[#070235] bg-[#070235]/5 dark:bg-[#070235]/10'
                            : 'border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {lang.label}
                        </span>
                        {selected ? <Check size={16} className="text-[#070235] shrink-0" /> : null}
                      </button>
                    )
                  })}
                </div>
              </Field>
              </>
            ) : (
              <div className="rounded-2xl border-2 border-[#070235] bg-[#070235]/5 dark:bg-[#070235]/10 p-5">
                <p className="text-base font-bold text-gray-900 dark:text-gray-100">{template.title}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">{template.subtitle}</p>
                <ul className="space-y-2">
                  {template.features.map(feature => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200">
                      <Check size={14} className="mt-0.5 text-[#070235] dark:text-sky-400 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="pt-2 flex flex-col gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-[#070235] hover:bg-[#3d3dcb] text-white py-4 rounded-full font-bold text-base shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <Spinner size="sm" className="text-white" />
                ) : (
                  <>
                    {step === 1 ? 'Continue' : 'Use this setup'}
                    <span className="text-lg">→</span>
                  </>
                )}
              </button>
              {step === 2 ? (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-center text-xs text-gray-400 uppercase tracking-widest font-medium hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  Change business type
                </button>
              ) : null}
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}

const fieldClass =
  'w-full bg-gray-100 dark:bg-gray-700 border-none rounded-lg px-4 py-4 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:ring-2 focus:ring-[#070235]/20 focus:bg-white dark:focus:bg-gray-600 transition-all'

function Field({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      {label ? (
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">
          {label}
        </label>
      ) : null}
      {children}
    </div>
  )
}
