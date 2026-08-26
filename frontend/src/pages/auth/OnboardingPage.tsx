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

const BANNER_GRADIENT = 'linear-gradient(135deg, #38bdf8 0%, #1d4ed8 45%, #0a0a2e 100%)'

export const OnboardingPage = () => {
  const { userProfile, completeOnboarding, updateBusinessType } = useAuth()
  const { language, setLanguage, t } = useLanguage()
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
      setError(t('onboarding.shopNameRequired'))
      return false
    }
    if (!phone.trim()) {
      setError(t('onboarding.phoneRequired'))
      return false
    }
    if (!businessAddress.trim()) {
      setError(t('onboarding.addressRequired'))
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
      setError(err instanceof Error ? err.message : t('onboarding.setupFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#f1f5f9] p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl">
        <section
          className="sm:w-[42%] px-8 py-10 sm:p-12 flex flex-col justify-between gap-8"
          style={{ background: BANNER_GRADIENT, color: '#fff' }}
        >
          <div>
            <div className="mb-8 sm:mb-12">
              <img
                src="/seznik_white_logo.png"
                alt="Seznik"
                className="w-32 sm:w-40 h-auto object-contain"
              />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight mb-4">
              {t('onboarding.bannerTitle')}
            </h1>
            <p className="text-sm sm:text-base leading-relaxed opacity-75 max-w-xs">
              {t('onboarding.bannerDesc')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              {
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                ),
                label: 'PERSONALIZED SETUP',
              },
              {
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ),
                label: 'MULTI-STORE READY',
              },
            ].map(badge => (
              <div
                key={badge.label}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium tracking-wide"
                style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}
              >
                {badge.icon}
                {badge.label}
              </div>
            ))}
          </div>
        </section>

        <section className="sm:w-[58%] px-8 py-10 sm:px-12 sm:py-14 bg-white flex flex-col justify-center max-h-[90vh] overflow-y-auto">
          <nav className="flex items-center gap-3 mb-8">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 1 ? 'bg-[#0a0a2e] text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                1
              </div>
              <span className="text-sm font-semibold text-slate-900">
                {pickTypeOnly ? t('onboarding.stepBusinessType') : t('onboarding.stepShopDetails')}
              </span>
            </div>
            <div className="w-8 h-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 2 ? 'bg-[#0a0a2e] text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                2
              </div>
              <span className={`text-sm font-medium ${step === 2 ? 'text-slate-900' : 'text-slate-400'}`}>
                {t('onboarding.stepWorkspace')}
              </span>
            </div>
          </nav>

          <header className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-2">
              {step === 1
                ? pickTypeOnly
                  ? t('onboarding.pickTypeTitle')
                  : t('onboarding.shopDetailsTitle')
                : t('onboarding.confirmTitle').replace('{type}', selectedLabel)}
            </h2>
            <p className="text-sm text-slate-500">
              {step === 1
                ? pickTypeOnly
                  ? t('onboarding.pickTypeDesc')
                  : t('onboarding.shopDetailsDesc')
                : t('onboarding.confirmDescAlt')}
            </p>
          </header>

          <form onSubmit={handleNext} className="flex flex-col gap-5">
            {step === 1 && !pickTypeOnly ? (
              <>
                <Field label={t('onboarding.shopName') + ' *'}>
                  <input
                    type="text"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    placeholder="e.g. Seznik Cafe"
                    autoFocus
                    className={fieldClass}
                  />
                </Field>
                <Field label={t('onboarding.shopLogo')}>
                  <p className="text-xs text-slate-500 -mt-1 mb-2">
                    {t('onboarding.logoOptional')}
                  </p>
                  <ImageUpload
                    value={logoUrl}
                    onChange={setLogoUrl}
                    previewSize="md"
                    accept="image/png,image/jpeg,image/jpg"
                    maxSizeMB={5}
                  />
                </Field>
                <Field label={t('onboarding.phone') + ' *'}>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className={fieldClass}
                  />
                </Field>
                <Field label={t('onboarding.address') + ' *'}>
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
                <Field label={pickTypeOnly ? undefined : t('onboarding.businessType') + ' *'}>
                  <div className="space-y-2">
                    {BUSINESS_TYPE_OPTIONS.map(option => {
                      const selected = selectedBusinessType === option.id
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setSelectedBusinessType(option.id)}
                          className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3 ${
                            selected
                              ? 'border-[#0a0a2e] bg-[#0a0a2e]/5 ring-1 ring-[#0a0a2e]'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-2xl">{option.emoji}</span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-semibold text-slate-900">
                              {option.label}
                            </span>
                            <span className="block text-xs text-slate-500 mt-0.5">
                              {option.description}
                            </span>
                          </span>
                          {selected ? <Check size={16} className="text-[#0a0a2e] shrink-0" /> : null}
                        </button>
                      )
                    })}
                  </div>
                </Field>
                <Field label={t('onboarding.appLanguage')}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                          className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                            selected
                              ? 'border-[#0a0a2e] bg-[#0a0a2e]/5 ring-1 ring-[#0a0a2e]'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {lang.label}
                          </span>
                          {selected ? <Check size={14} className="text-[#0a0a2e] shrink-0" /> : null}
                        </button>
                      )
                    })}
                  </div>
                </Field>
              </>
            ) : (
              <div className="rounded-xl border border-[#0a0a2e] bg-[#0a0a2e]/5 p-5">
                <p className="text-base font-semibold text-slate-900">{template.title}</p>
                <p className="text-sm text-slate-500 mt-1 mb-4">{template.subtitle}</p>
                <ul className="space-y-2">
                  {template.features.map(feature => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-800">
                      <Check size={14} className="mt-0.5 text-[#0a0a2e] shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error ? <p className="text-red-500 text-sm font-medium">{error}</p> : null}

            <div className="pt-1 flex flex-col gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-lg bg-[#0a0a2e] text-white text-sm sm:text-base font-semibold transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ boxShadow: '0 10px 25px -5px rgba(10,10,46,0.3)' }}
              >
                {isSaving ? (
                  <Spinner size="sm" className="text-white" />
                ) : (
                  <>
                    {step === 1 ? t('onboarding.continue') : t('onboarding.useSetup')}
                    <span aria-hidden="true">→</span>
                  </>
                )}
              </button>
              {step === 2 ? (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-center text-xs text-slate-400 uppercase tracking-widest font-medium hover:text-slate-600 transition-colors"
                >
                  {t('onboarding.changeBusinessType')}
                </button>
              ) : null}
            </div>
          </form>

          <p className="text-center mt-8 text-[10px] text-slate-300">© 2026 Seznik POS. All rights reserved.</p>
        </section>
      </div>
    </div>
  )
}

const fieldClass =
  'w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0a0a2e] bg-white'

function Field({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      {label ? (
        <label className="block text-sm font-medium text-slate-700">{label}</label>
      ) : null}
      {children}
    </div>
  )
}
