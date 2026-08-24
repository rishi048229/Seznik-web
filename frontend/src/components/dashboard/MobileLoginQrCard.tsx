import { QRCodeSVG } from 'qrcode.react'
import { CheckCircle2, QrCode, RefreshCw, Smartphone } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useQrLogin } from '@/hooks/useQrLogin'
import { useLanguage } from '@/contexts/LanguageContext'

const formatCountdown = (seconds: number) => {
  const safe = Math.max(0, seconds)
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export const MobileLoginQrCard = () => {
  const { t } = useLanguage()
  const { session, isLoading, isError, status, secondsLeft, regenerate, isRegenerating } = useQrLogin()

  return (
    <Card data-tour="mobile-qr-login" className="p-5 bg-white border border-gray-100 shadow-sm mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="flex-shrink-0 self-center sm:self-start">
          <div className="relative w-[188px] h-[188px] rounded-2xl bg-white border border-gray-200 dark:border-gray-600 p-2 flex items-center justify-center">
            {status === 'consumed' ? (
              <div className="flex flex-col items-center text-center px-3">
                <CheckCircle2 size={40} className="text-emerald-500 mb-2" />
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  {t('dashboard.mobileLoginConsumed')}
                </p>
              </div>
            ) : isLoading || !session?.qrPayload ? (
              <div className="w-40 h-40 rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse" />
            ) : (
              <QRCodeSVG
                value={session.qrPayload}
                size={168}
                level="M"
                marginSize={2}
                bgColor="#ffffff"
                fgColor="#0f172a"
                title="Seznik mobile login"
              />
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 mb-2">
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <Smartphone size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                {t('dashboard.mobileLoginTitle')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {status === 'consumed'
                  ? t('dashboard.mobileLoginConsumedDesc')
                  : t('dashboard.mobileLoginDesc')}
              </p>
            </div>
          </div>

          {status !== 'consumed' && (
            <ol className="mt-3 space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex gap-2">
                <span className="font-semibold text-gray-400 w-4">1.</span>
                {t('dashboard.mobileLoginStep1')}
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-gray-400 w-4">2.</span>
                {t('dashboard.mobileLoginStep2')}
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-gray-400 w-4">3.</span>
                {t('dashboard.mobileLoginStep3')}
              </li>
            </ol>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-4">
            {isError ? (
              <p className="text-sm text-red-600">{t('dashboard.mobileLoginError')}</p>
            ) : status === 'pending' && session ? (
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <QrCode size={14} />
                {t('dashboard.mobileLoginExpires')} {formatCountdown(secondsLeft)}
              </p>
            ) : null}

            <Button
              variant="outline"
              size="sm"
              onClick={() => void regenerate()}
              loading={isRegenerating}
              leftIcon={<RefreshCw size={14} />}
            >
              {t('dashboard.mobileLoginRefresh')}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
