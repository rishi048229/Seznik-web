import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
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
import { buildUpiPayLink, isValidUpiVpa } from '@/utils/upiQr'

const BANNER_GRADIENT = 'linear-gradient(135deg, #38bdf8 0%, #1d4ed8 45%, #0a0a2e 100%)'

export const OnboardingPage = () => {
  const { userProfile, completeOnboarding, updateBusinessType } = useAuth()
  const { language, setLanguage, t } = useLanguage()
  const navigate = useNavigate()

  const pickTypeOnly = userProfile?.onboardingCompleted === true && !userProfile?.businessType
  const lastStep = pickTypeOnly ? 2 : 3

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [businessName, setBusinessName] = useState(userProfile?.businessName ?? '')
  const [phone, setPhone] = useState(userProfile?.phone ?? '')
  const [businessAddress, setBusinessAddress] = useState('')
  const [selectedBusinessType, setSelectedBusinessType] = useState<BusinessType>(
    userProfile?.businessType ?? 'retail_shop'
  )
  const [logoUrl, setLogoUrl] = useState('')
  const [upiId, setUpiId] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(language)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const template = BUSINESS_TEMPLATES[selectedBusinessType]
  const selectedLabel =
    BUSINESS_TYPE_OPTIONS.find(option => option.id === selectedBusinessType)?.label ?? 'workspace'
  const showPaymentStep = !pickTypeOnly && step === 2
  const showWorkspaceStep = pickTypeOnly ? step === 2 : step === 3
  const upiPreview = isValidUpiVpa(upiId)
    ? buildUpiPayLink({
        upiId: upiId.trim(),
        payeeName: businessName.trim() || 'Your shop',
        amount: 100,
        note: 'Sample bill',
      })
    : ''

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

    if (pickTypeOnly) {
      if (step === 1) {
        setStep(2)
        return
      }
      setIsSaving(true)
      try {
        setLanguage(selectedLanguage)
        await updateBusinessType(selectedBusinessType)
        navigate(ROUTES.ACCESS_SELECTION)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('onboarding.setupFailed'))
      } finally {
        setIsSaving(false)
      }
      return
    }

    if (step === 1) {
      if (!validateShopDetails()) return
      setStep(2)
      return
    }

    if (step === 2) {
      if (!isValidUpiVpa(upiId)) {
        setError(t('onboarding.upiRequired'))
        return
      }
      setStep(3)
      return
    }

    setIsSaving(true)
    try {
      setLanguage(selectedLanguage)
      await completeOnboarding({
        businessName: businessName.trim(),
        businessType: selectedBusinessType,
        phone: phone.trim(),
        businessAddress: businessAddress.trim(),
        upiId: upiId.trim(),
        ...(logoUrl.trim() ? { businessLogoURL: logoUrl.trim() } : {}),
      })
      navigate(ROUTES.ACCESS_SELECTION)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('onboarding.setupFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  const stepLabel = (n: number, label: string, active: boolean) => (
    <div className="flex items-center gap-2 min-w-0">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          active ? 'bg-[#0a0a2e] dark:bg-zinc-100 dark:text-zinc-900' : 'bg-slate-200 dark:bg-dark-elevated text-slate-500 dark:text-gray-400'
        }`}
      >
        {n}
      </div>
      <span className={`text-sm font-medium truncate ${active ? 'text-slate-900 dark:text-gray-100 font-semibold' : 'text-slate-400 dark:text-gray-500'}`}>
        {label}
      </span>
    </div>
  )

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#f1f5f9] dark:bg-dark-bg p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl dark:border dark:border-dark-border">
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

        <section className="sm:w-[58%] px-8 py-10 sm:px-12 sm:py-14 bg-white dark:bg-dark-card flex flex-col justify-center max-h-[90vh] overflow-y-auto">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
            {t('onboarding.stepOf')
              .replace('{step}', String(step))
              .replace('{total}', String(lastStep))}
          </p>
          <nav className="flex items-center gap-2 sm:gap-3 mb-8 flex-wrap">
            {pickTypeOnly ? (
              <>
                {stepLabel(1, t('onboarding.stepBusinessType'), step === 1)}
                <div className="w-8 h-px bg-slate-200 dark:bg-dark-border hidden sm:block" />
                {stepLabel(2, t('onboarding.stepWorkspace'), step === 2)}
              </>
            ) : (
              <>
                {stepLabel(1, t('onboarding.stepShopDetails'), step === 1)}
                <div className="w-6 h-px bg-slate-200 dark:bg-dark-border hidden sm:block" />
                {stepLabel(2, t('onboarding.stepPayment'), step === 2)}
                <div className="w-6 h-px bg-slate-200 dark:bg-dark-border hidden sm:block" />
                {stepLabel(3, t('onboarding.stepWorkspace'), step === 3)}
              </>
            )}
          </nav>

          <header className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-2">
              {step === 1
                ? pickTypeOnly
                  ? t('onboarding.pickTypeTitle')
                  : t('onboarding.shopDetailsTitle')
                : showPaymentStep
                  ? t('onboarding.paymentTitle')
                  : t('onboarding.confirmTitle').replace('{type}', selectedLabel)}
            </h2>
            <p className="text-sm text-slate-500">
              {step === 1
                ? pickTypeOnly
                  ? t('onboarding.pickTypeDesc')
                  : t('onboarding.shopDetailsDesc')
                : showPaymentStep
                  ? t('onboarding.paymentDesc')
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
                    enableBackgroundCleanup
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
                              ? 'border-[#0a0a2e] dark:border-zinc-500 bg-[#0a0a2e]/5 dark:bg-white/10 ring-1 ring-[#0a0a2e] dark:ring-zinc-500'
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
                          {selected ? <Check size={16} className="text-[#0a0a2e] dark:text-indigo-300 shrink-0" /> : null}
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
                              ? 'border-[#0a0a2e] dark:border-zinc-500 bg-[#0a0a2e]/5 dark:bg-white/10 ring-1 ring-[#0a0a2e] dark:ring-zinc-500'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {lang.label}
                          </span>
                          {selected ? <Check size={14} className="text-[#0a0a2e] dark:text-indigo-300 shrink-0" /> : null}
                        </button>
                      )
                    })}
                  </div>
                </Field>
              </>
            ) : null}

            {showPaymentStep ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <QrCode size={18} />
                    </div>
                    <p className="text-sm text-emerald-950 leading-relaxed">{t('onboarding.upiHint')}</p>
                  </div>
                </div>
                <Field label={t('onboarding.upiId') + ' *'}>
                  <input
                    type="text"
                    value={upiId}
                    onChange={e => setUpiId(e.target.value)}
                    placeholder={t('onboarding.upiPlaceholder')}
                    autoComplete="off"
                    inputMode="email"
                    spellCheck={false}
                    autoFocus
                    className={fieldClass}
                  />
                </Field>
                {upiPreview ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <QRCodeSVG value={upiPreview} size={148} />
                    <p className="text-[11px] text-slate-500 text-center">{t('onboarding.upiPreviewNote')}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {showWorkspaceStep ? (
              <div className="rounded-xl border border-[#0a0a2e] dark:border-zinc-500 bg-[#0a0a2e]/5 dark:bg-white/10 p-5">
                <p className="text-base font-semibold text-slate-900">{template.title}</p>
                <p className="text-sm text-slate-500 mt-1 mb-4">{template.subtitle}</p>
                <ul className="space-y-2">
                  {template.features.map(feature => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-800">
                      <Check size={14} className="mt-0.5 text-[#0a0a2e] dark:text-indigo-300 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {error ? <p className="text-red-500 text-sm font-medium">{error}</p> : null}

            <div className="pt-1 flex flex-col gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-lg bg-[#0a0a2e] dark:bg-zinc-100 dark:text-zinc-900 text-sm sm:text-base font-semibold transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ boxShadow: '0 10px 25px -5px rgba(10,10,46,0.3)' }}
              >
                {isSaving ? (
                  <Spinner size="sm" className="text-white" />
                ) : (
                  <>
                    {step === lastStep ? t('onboarding.useSetup') : t('onboarding.continue')}
                    <span aria-hidden="true">→</span>
                  </>
                )}
              </button>
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setError('')
                    setStep(prev => (prev > 1 ? ((prev - 1) as 1 | 2 | 3) : prev))
                  }}
                  className="text-center text-xs text-slate-400 uppercase tracking-widest font-medium hover:text-slate-600 transition-colors"
                >
                  {t('onboarding.back')}
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
  'w-full px-4 py-2.5 border border-slate-300 dark:border-dark-border-strong rounded-lg text-slate-900 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0a0a2e] dark:focus:ring-zinc-400 bg-white dark:bg-dark-elevated'

function Field({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      {label ? (
        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">{label}</label>
      ) : null}
      {children}
    </div>
  )
}
