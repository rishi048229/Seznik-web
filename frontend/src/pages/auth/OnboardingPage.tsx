import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, QrCode, ArrowLeft, ArrowRight } from 'lucide-react'
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
    const cleanPhone = phone.replace(/\D/g, '')
    if (!cleanPhone || cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit phone number')
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
        phone: phone.replace(/\D/g, '').slice(0, 10),
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
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
          active
            ? 'bg-[#0a0a2e] text-white dark:bg-blue-600 dark:text-white shadow-sm ring-2 ring-blue-500/20'
            : 'bg-slate-200 dark:bg-dark-elevated text-slate-500 dark:text-gray-400'
        }`}
      >
        {n}
      </div>
      <span className={`text-xs sm:text-sm font-medium truncate ${active ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-400 dark:text-gray-400'}`}>
        {label}
      </span>
    </div>
  )

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#f1f5f9] dark:bg-dark-bg p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row w-full max-w-4xl min-h-[640px] sm:min-h-[720px] rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card transition-all">
        {/* Left Banner */}
        <section
          className="sm:w-[38%] px-8 py-10 sm:p-12 flex flex-col justify-between gap-8"
          style={{ background: BANNER_GRADIENT, color: '#fff' }}
        >
          <div>
            <div className="mb-8 sm:mb-12">
              <img
                src="/seznik_white_logo.png"
                alt="Seznik"
                className="w-32 sm:w-44 h-auto object-contain"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold leading-snug tracking-tight mb-4 text-white">
              {t('onboarding.bannerTitle')}
            </h1>
            <p className="text-xs sm:text-sm leading-relaxed text-white/85 max-w-xs">
              {t('onboarding.bannerDesc')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
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
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wide text-white"
                style={{ background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)' }}
              >
                {badge.icon}
                {badge.label}
              </div>
            ))}
          </div>
        </section>

        {/* Right Form Content */}
        <section className="sm:w-[62%] px-8 py-9 sm:px-12 sm:py-12 bg-white dark:bg-dark-card flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-gray-400 mb-3">
              {t('onboarding.stepOf')
                .replace('{step}', String(step))
                .replace('{total}', String(lastStep))}
            </p>

            <nav className="flex items-center gap-2 sm:gap-3 mb-7 flex-wrap">
              {pickTypeOnly ? (
                <>
                  <button type="button" onClick={() => setStep(1)} className="focus:outline-none cursor-pointer">
                    {stepLabel(1, t('onboarding.stepBusinessType'), step === 1)}
                  </button>
                  <div className="w-8 h-px bg-slate-200 dark:bg-dark-border hidden sm:block" />
                  <button type="button" onClick={() => step > 1 && setStep(2)} disabled={step < 2} className="focus:outline-none disabled:cursor-default">
                    {stepLabel(2, t('onboarding.stepWorkspace'), step === 2)}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setStep(1)} className="focus:outline-none cursor-pointer">
                    {stepLabel(1, t('onboarding.stepShopDetails'), step === 1)}
                  </button>
                  <div className="w-6 h-px bg-slate-200 dark:bg-dark-border hidden sm:block" />
                  <button type="button" onClick={() => (step > 2 || validateShopDetails()) && setStep(2)} className="focus:outline-none cursor-pointer">
                    {stepLabel(2, t('onboarding.stepPayment'), step === 2)}
                  </button>
                  <div className="w-6 h-px bg-slate-200 dark:bg-dark-border hidden sm:block" />
                  <button type="button" onClick={() => (step === 3 || (validateShopDetails() && isValidUpiVpa(upiId))) && setStep(3)} className="focus:outline-none cursor-pointer">
                    {stepLabel(3, t('onboarding.stepWorkspace'), step === 3)}
                  </button>
                </>
              )}
            </nav>

            <header className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
                {step === 1
                  ? pickTypeOnly
                    ? t('onboarding.pickTypeTitle')
                    : t('onboarding.shopDetailsTitle')
                  : showPaymentStep
                    ? t('onboarding.paymentTitle')
                    : t('onboarding.confirmTitle').replace('{type}', selectedLabel)}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400 leading-relaxed">
                {step === 1
                  ? pickTypeOnly
                    ? t('onboarding.pickTypeDesc')
                    : t('onboarding.shopDetailsDesc')
                  : showPaymentStep
                    ? t('onboarding.paymentDesc')
                    : t('onboarding.confirmDescAlt')}
              </p>
            </header>

            <form onSubmit={handleNext} className="flex flex-col gap-4 sm:gap-5">
              {/* Step 1: Shop Information */}
              {step === 1 && !pickTypeOnly ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <Field label={t('onboarding.phone') + ' *'}>
                      <input
                        type="tel"
                        maxLength={10}
                        value={phone}
                        onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="e.g. 9876543210"
                        className={fieldClass}
                      />
                    </Field>
                  </div>

                  <Field label={t('onboarding.address') + ' *'}>
                    <input
                      type="text"
                      value={businessAddress}
                      onChange={e => setBusinessAddress(e.target.value)}
                      placeholder="Street, area, city"
                      className={fieldClass}
                    />
                  </Field>

                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-gray-200">
                        {t('onboarding.shopLogo')}
                      </label>
                      <span className="text-xs text-slate-400 dark:text-gray-400 font-normal">
                        {t('onboarding.logoOptional')}
                      </span>
                    </div>
                    <div className="p-5 sm:p-6 rounded-2xl border border-dashed border-slate-300 dark:border-dark-border bg-slate-50/50 dark:bg-dark-elevated/40">
                      <ImageUpload
                        value={logoUrl}
                        onChange={setLogoUrl}
                        previewSize="md"
                        accept="image/png,image/jpeg,image/jpg"
                        maxSizeMB={5}
                        enableBackgroundCleanup
                      />
                    </div>
                  </div>
                </>
              ) : null}

              {/* Step 2: UPI Payment Details */}
              {showPaymentStep ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 p-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <QrCode size={18} />
                      </div>
                      <p className="text-xs sm:text-sm text-emerald-950 dark:text-emerald-200 leading-relaxed">{t('onboarding.upiHint')}</p>
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
                    <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-elevated p-5">
                      <div className="bg-white p-3 rounded-2xl shadow-sm">
                        <QRCodeSVG value={upiPreview} size={140} />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-gray-400 text-center">{t('onboarding.upiPreviewNote')}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Step 3 (or Step 1 for pickTypeOnly): Workspace Type & Language */}
              {(showWorkspaceStep || (pickTypeOnly && step === 1)) ? (
                <div className="space-y-5">
                  <Field label={t('onboarding.businessType') + ' *'}>
                    <div className="space-y-3">
                      {BUSINESS_TYPE_OPTIONS.map(option => {
                        const selected = selectedBusinessType === option.id
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setSelectedBusinessType(option.id)}
                            className={`w-full text-left p-4 sm:p-4.5 rounded-2xl border transition-all flex items-center gap-4 ${
                              selected
                                ? 'border-blue-600 dark:border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-600 dark:ring-blue-500 shadow-sm'
                                : 'border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated hover:border-slate-300 dark:hover:border-zinc-600 hover:bg-slate-50 dark:hover:bg-dark-card'
                            }`}
                          >
                            <span className="text-3xl shrink-0">{option.emoji}</span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                                {option.label}
                              </span>
                              <span className="block text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                                {option.description}
                              </span>
                            </span>
                            {selected ? <Check size={20} className="text-blue-600 dark:text-blue-400 shrink-0 font-bold" /> : null}
                          </button>
                        )
                      })}
                    </div>
                  </Field>

                  <Field label={t('onboarding.appLanguage')}>
                    <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
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
                            className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all flex items-center justify-between gap-1.5 ${
                              selected
                                ? 'border-blue-600 dark:border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-600 dark:ring-blue-500 text-blue-950 dark:text-white font-semibold shadow-sm'
                                : 'border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated hover:border-slate-300 dark:hover:border-zinc-600 hover:bg-slate-50 dark:hover:bg-dark-card text-slate-800 dark:text-gray-200'
                            }`}
                          >
                            <span className="text-xs sm:text-sm font-medium truncate">
                              {lang.label}
                            </span>
                            {selected ? <Check size={14} className="text-blue-600 dark:text-blue-400 shrink-0 font-bold" /> : null}
                          </button>
                        )
                      })}
                    </div>
                  </Field>
                </div>
              ) : null}

              {error ? <p className="text-red-500 text-xs font-medium">{error}</p> : null}

              {/* Bottom Navigation Buttons */}
              <div className="pt-5 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-dark-border/60 mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setError('')
                    if (step > 1) {
                      setStep(prev => (prev > 1 ? ((prev - 1) as 1 | 2 | 3) : prev))
                    } else {
                      navigate(ROUTES.LOGIN)
                    }
                  }}
                  className="flex items-center justify-center gap-2 py-3 px-6 rounded-2xl border border-slate-300 dark:border-dark-border bg-white dark:bg-dark-elevated hover:bg-slate-100 dark:hover:bg-dark-border text-xs sm:text-sm font-semibold text-slate-700 dark:text-gray-200 transition-all active:scale-[0.98] shadow-sm"
                >
                  <ArrowLeft size={16} />
                  <span>Back</span>
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center justify-center gap-2 py-3 px-8 rounded-2xl bg-[#0a0a2e] hover:bg-[#1a1555] text-white dark:bg-blue-600 dark:hover:bg-blue-500 text-xs sm:text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25 ml-auto"
                >
                  {isSaving ? (
                    <Spinner size="sm" className="text-white" />
                  ) : (
                    <>
                      <span>{step === lastStep ? t('onboarding.useSetup') : 'Next'}</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          <p className="text-center mt-6 text-[11px] text-slate-400 dark:text-gray-500">© 2026 Seznik POS. All rights reserved.</p>
        </section>
      </div>
    </div>
  )
}

const fieldClass =
  'w-full px-4 py-2.5 border border-slate-300 dark:border-dark-border rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0a0a2e] dark:focus:ring-blue-500 bg-white dark:bg-dark-elevated transition-colors text-xs sm:text-sm'

function Field({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <label className="block text-xs font-semibold text-slate-700 dark:text-gray-200">{label}</label>
      ) : null}
      {children}
    </div>
  )
}
