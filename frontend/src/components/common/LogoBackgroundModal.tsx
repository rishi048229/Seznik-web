import React, { useState, useEffect } from 'react';
import {
  Wand2,
  Check,
  X,
  Receipt,
  SunMedium,
  Sliders,
  RefreshCw,
  Image as ImageIcon,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import {
  removeImageBackground,
  analyzeLogoForThermal,
  type LogoProcessMode,
  type LogoThermalAnalysis,
} from '@/utils/imageBackgroundRemoval';
import { useLanguage } from '@/contexts/LanguageContext';

export interface LogoBackgroundModalProps {
  isOpen: boolean;
  imageSrc: string | File | null;
  onApply: (finalDataUrl: string, isProcessed: boolean) => void;
  onCancel: () => void;
}

export const LogoBackgroundModal: React.FC<LogoBackgroundModalProps> = ({
  isOpen,
  imageSrc,
  onApply,
  onCancel,
}) => {
  const { t } = useLanguage();

  const [selectedMode, setSelectedMode] = useState<LogoProcessMode>('white_clean');
  const [invertColors, setInvertColors] = useState<boolean>(false);
  const [tolerance, setTolerance] = useState<number>(45);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [previewTheme, setPreviewTheme] = useState<'receipt' | 'transparent'>('receipt');
  const [analysis, setAnalysis] = useState<LogoThermalAnalysis | null>(null);

  // Convert File to Object URL / preview string
  useEffect(() => {
    if (!imageSrc) {
      setOriginalPreviewUrl(null);
      return;
    }
    if (imageSrc instanceof File) {
      const url = URL.createObjectURL(imageSrc);
      setOriginalPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setOriginalPreviewUrl(imageSrc);
  }, [imageSrc]);

  const reprocess = (
    src: string | File,
    mode: LogoProcessMode,
    inv: boolean,
    tol: number
  ) => {
    if (mode === 'keep_bg') {
      if (src instanceof File) {
        const reader = new FileReader();
        reader.onload = (e) => setProcessedUrl(e.target?.result as string);
        reader.readAsDataURL(src);
      } else {
        setProcessedUrl(src);
      }
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    removeImageBackground(src, {
      mode: mode === 'white_clean' ? 'white_clean' : 'transparent',
      tolerance: tol,
      softness: 16,
      trimPadding: true,
      invert: inv,
    })
      .then((res) => {
        setProcessedUrl(res.dataUrl);
        setIsProcessing(false);
      })
      .catch((err) => {
        console.warn('Background removal error:', err);
        if (src instanceof File) {
          const reader = new FileReader();
          reader.onload = (e) => setProcessedUrl(e.target?.result as string);
          reader.readAsDataURL(src);
        } else {
          setProcessedUrl(src);
        }
        setIsProcessing(false);
      });
  };

  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    let cancelled = false;
    setSelectedMode('white_clean');
    setInvertColors(false);
    setTolerance(45);
    setAnalysis(null);
    setIsProcessing(true);

    analyzeLogoForThermal(imageSrc)
      .then((result) => {
        if (cancelled) return;
        const mode = result?.recommendedMode ?? 'white_clean';
        const inv = result?.recommendedInvert ?? false;
        setAnalysis(result);
        setSelectedMode(mode);
        setInvertColors(inv);
        reprocess(imageSrc, mode, inv, 45);
      })
      .catch(() => {
        if (cancelled) return;
        setSelectedMode('white_clean');
        reprocess(imageSrc, 'white_clean', false, 45);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, imageSrc]);

  if (!isOpen || !imageSrc) return null;

  const currentPreview =
    selectedMode === 'keep_bg'
      ? originalPreviewUrl
      : processedUrl || originalPreviewUrl;

  const handleModeChange = (mode: LogoProcessMode) => {
    setSelectedMode(mode);
    reprocess(imageSrc, mode, invertColors, tolerance);
  };

  const handleInvertToggle = () => {
    const nextInv = !invertColors;
    setInvertColors(nextInv);
    reprocess(imageSrc, selectedMode, nextInv, tolerance);
  };

  const handleToleranceChange = (tol: number) => {
    setTolerance(tol);
    reprocess(imageSrc, selectedMode, invertColors, tol);
  };

  const handleConfirm = () => {
    if (selectedMode !== 'keep_bg' && processedUrl) {
      onApply(processedUrl, true);
    } else if (originalPreviewUrl) {
      onApply(originalPreviewUrl, false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-dark-card rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 dark:border-dark-border overflow-hidden transform transition-all">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-dark-border flex items-center justify-between bg-gradient-to-r from-blue-50/50 via-white to-transparent dark:from-blue-950/20 dark:via-dark-card dark:to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-white flex items-center justify-center shadow-inner">
              <Wand2 size={20} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                {t('image.logoBackgroundOption')}
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  <Sparkles size={10} /> Auto-Safe
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('image.chooseLogoBackground')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-elevated transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Options Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Option 1: Remove Background (Transparent) */}
            <div
              onClick={() => handleModeChange('transparent')}
              className={`relative cursor-pointer rounded-xl p-3.5 border-2 transition-all flex flex-col justify-between ${
                selectedMode === 'transparent'
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 dark:border-zinc-500 shadow-sm'
                  : 'border-gray-200 dark:border-dark-border bg-gray-50/50 dark:bg-dark-elevated hover:border-gray-300 dark:hover:border-dark-border-strong'
              }`}
            >
              {analysis?.recommendedMode === 'transparent' && (
                <span className="absolute -top-2.5 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm flex items-center gap-1">
                  ✓ {t('image.bestBadge')}
                </span>
              )}
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-white ${
                    selectedMode === 'transparent' ? 'bg-blue-600' : 'bg-gray-400 dark:bg-dark-hover'
                  }`}
                >
                  <Wand2 size={14} />
                </div>
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    selectedMode === 'transparent' ? 'border-blue-600' : 'border-gray-300 dark:border-dark-border-strong'
                  }`}
                >
                  {selectedMode === 'transparent' && (
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                  {t('image.removeBackground')}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
                  {t('image.removeBgSub')}
                </p>
              </div>
            </div>

            {/* Option 2: Clean White */}
            <div
              onClick={() => handleModeChange('white_clean')}
              className={`relative cursor-pointer rounded-xl p-3.5 border-2 transition-all flex flex-col justify-between ${
                selectedMode === 'white_clean'
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 dark:border-zinc-500 shadow-sm'
                  : 'border-gray-200 dark:border-dark-border bg-gray-50/50 dark:bg-dark-elevated hover:border-gray-300 dark:hover:border-dark-border-strong'
              }`}
            >
              {analysis?.recommendedMode === 'white_clean' && (
                <span className="absolute -top-2.5 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm flex items-center gap-1">
                  ✓ {t('image.bestBadge')}
                </span>
              )}
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-white ${
                    selectedMode === 'white_clean' ? 'bg-emerald-600' : 'bg-gray-400 dark:bg-dark-hover'
                  }`}
                >
                  <SunMedium size={14} />
                </div>
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    selectedMode === 'white_clean' ? 'border-blue-600' : 'border-gray-300 dark:border-dark-border-strong'
                  }`}
                >
                  {selectedMode === 'white_clean' && (
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                  {t('image.cleanWhite')}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
                  {t('image.whiteBgSub')}
                </p>
              </div>
            </div>

            {/* Option 3: Keep Original */}
            <div
              onClick={() => handleModeChange('keep_bg')}
              className={`relative cursor-pointer rounded-xl p-3.5 border-2 transition-all flex flex-col justify-between ${
                selectedMode === 'keep_bg'
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 dark:border-zinc-500 shadow-sm'
                  : 'border-gray-200 dark:border-dark-border bg-gray-50/50 dark:bg-dark-elevated hover:border-gray-300 dark:hover:border-dark-border-strong'
              }`}
            >
              {analysis?.recommendedMode === 'keep_bg' && (
                <span className="absolute -top-2.5 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm flex items-center gap-1">
                  ✓ {t('image.bestBadge')}
                </span>
              )}
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-white ${
                    selectedMode === 'keep_bg' ? 'bg-slate-700' : 'bg-gray-400 dark:bg-dark-hover'
                  }`}
                >
                  <ImageIcon size={14} />
                </div>
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    selectedMode === 'keep_bg' ? 'border-blue-600' : 'border-gray-300 dark:border-dark-border-strong'
                  }`}
                >
                  {selectedMode === 'keep_bg' && (
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                  {t('image.keepOriginal')}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
                  {t('image.keepBgSub')}
                </p>
              </div>
            </div>
          </div>

          {/* Smart Analysis Guidance Bar */}
          {analysis?.hint && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200">
              <Sparkles size={15} className="text-blue-600 dark:text-white mt-0.5 flex-shrink-0" />
              <p className="leading-relaxed">{analysis.hint}</p>
            </div>
          )}

          {/* Warning banner when selecting Transparent on white backgrounds */}
          {selectedMode === 'transparent' && analysis?.backgroundIsWhite && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
              <AlertCircle size={15} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="leading-relaxed">{t('image.whiteBgRemoveWarning')}</p>
            </div>
          )}

          {/* Fine Tuning Bar */}
          {selectedMode !== 'keep_bg' && (
            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-dark-elevated border border-gray-200 dark:border-dark-border space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
                  <Sliders size={13} className="text-gray-500" />
                  <span>{t('image.sensitivity')}:</span>
                </div>
                <div className="flex items-center gap-1">
                  {[
                    { label: t('image.low'), val: 25 },
                    { label: t('image.medium'), val: 45 },
                    { label: t('image.high'), val: 70 },
                  ].map((s) => (
                    <button
                      key={s.val}
                      type="button"
                      onClick={() => handleToleranceChange(s.val)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                        tolerance === s.val
                          ? 'bg-blue-600 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                          : 'bg-white dark:bg-dark-elevated text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-border-strong hover:bg-gray-100'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-dark-border flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleInvertToggle}
                  className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                    invertColors
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                      : 'bg-white dark:bg-dark-elevated text-gray-700 dark:text-gray-300 border-gray-200 dark:border-dark-border-strong hover:bg-gray-100'
                  }`}
                >
                  <RefreshCw size={12} className={invertColors ? 'text-emerald-600' : 'text-gray-500'} />
                  <span>
                    {t('image.invertColors')}:{' '}
                    <strong className={invertColors ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-500'}>
                      {invertColors ? t('image.invertOn') : t('image.invertOff')}
                    </strong>
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Live Preview Container */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400 text-[11px]">
                {t('image.realtimePreview')}
              </span>
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-elevated p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPreviewTheme('receipt')}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all ${
                    previewTheme === 'receipt'
                      ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 shadow-xs'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Receipt size={11} />
                  {t('image.previewReceipt')}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTheme('transparent')}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all ${
                    previewTheme === 'transparent'
                      ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 shadow-xs'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {t('image.previewCanvas')}
                </button>
              </div>
            </div>

            <div
              className={`relative rounded-xl border p-4 flex flex-col items-center justify-center min-h-[170px] transition-all overflow-hidden ${
                previewTheme === 'receipt'
                  ? 'bg-white border-gray-300 shadow-inner'
                  : 'bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:12px_12px] bg-slate-100 dark:bg-dark-bg dark:border-dark-border'
              }`}
            >
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                  <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {t('image.processingLogo')}
                  </p>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center justify-center">
                  {currentPreview && (
                    <div className="max-h-24 max-w-[200px] flex items-center justify-center p-1">
                      <img
                        src={currentPreview}
                        alt="Logo preview"
                        className="max-h-20 max-w-full object-contain filter drop-shadow-xs"
                      />
                    </div>
                  )}
                  {previewTheme === 'receipt' && (
                    <div className="mt-2 text-center text-slate-700 select-none font-mono">
                      <p className="text-xs font-bold tracking-wider">SEZNIK STORE</p>
                      <p className="text-[10px] text-slate-500">123 Market Road • Phone: 9876543210</p>
                      <p className="text-[10px] text-slate-400 tracking-widest mt-0.5">
                        --------------------------------
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-dark-border bg-gray-50 dark:bg-dark-card/80 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-elevated rounded-xl transition-colors"
          >
            {t('action.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-blue-500/20 transition-all"
          >
            <Check size={15} />
            {t('image.applyLogo')}
          </button>
        </div>
      </div>
    </div>
  );
};
