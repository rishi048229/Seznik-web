import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCreateCategory } from '@/hooks/useCategories'
import { Spinner } from '@/components/ui/Spinner'
import { ROUTES } from '@/constants/routes'

export const OnboardingPage = () => {
  const { userProfile, completeOnboarding } = useAuth()
  const [businessName, setBusinessName] = useState(userProfile?.businessName ?? '')
  const [categoryName, setCategoryName] = useState('')
  const [step, setStep] = useState<'business' | 'category'>('business')

  const { mutate: createCategory, isPending } = useCreateCategory()
  const navigate = useNavigate()

  const handleBusinessSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (businessName.trim()) {
      setStep('category')
    }
  }

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (categoryName.trim()) {
      createCategory(categoryName.trim(), {
        onSuccess: async () => {
          await completeOnboarding(businessName)
          navigate(ROUTES.ACCESS_SELECTION)
        },
      })
    }
  }

  const handleSkip = async () => {
    await completeOnboarding(businessName)
    navigate(ROUTES.ACCESS_SELECTION)
  }

  const categoryOptions = [
    { name: 'Groceries', icon: '🛒' },
    { name: 'Fashion & Apparel', icon: '👕' },
    { name: 'Food & Beverage', icon: '🍽️' },
    { name: 'Electronics', icon: '📱' },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 overflow-x-hidden">
      {/* Background Accents */}
      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#1e1b4b]/10 blur-[120px] rounded-full -z-10" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/5 blur-[100px] rounded-full -z-10" />

      {/* Main Card */}
      <div className="w-full max-w-4xl grid md:grid-cols-12 overflow-hidden bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
        {/* Left Branding Side — hidden on mobile */}
        <section className="hidden md:flex md:col-span-5 bg-gradient-to-br from-[#070235] to-[#3d3dcb] relative p-12 flex-col justify-between overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <img
                src="/seznik_logo.png"
                alt="Seznik Logo"
                className="w-10 h-10 object-contain"
              />
              <img src="/seznik_logo.png" alt="Seznik" className="w-12 h-auto object-contain" />
            </div>
            <h2 className="text-3xl font-extrabold text-white leading-tight mb-4">
              Welcome to the<br />Future of Retail.
            </h2>
            <p className="text-white/80 text-sm leading-relaxed max-w-xs">
              Elevate your business management with our seamless inventory system.
              Let's get your store set up in seconds.
            </p>
          </div>

          {/* Visual Element */}
          <div className="relative mt-12 z-10">
            <div className="aspect-square w-full rounded-2xl bg-white/10 border border-white/10 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-t from-[#070235]/80 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#39b8fd]" />
                  <span className="text-[10px] uppercase tracking-widest text-white/60 font-bold">New Merchant</span>
                </div>
                <p className="text-white font-semibold italic text-sm">
                  "Setting up was so intuitive, I had my first sale in minutes."
                </p>
              </div>
            </div>
          </div>

          {/* Background Shape */}
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-[#1e1b4b] rounded-full blur-3xl opacity-20" />
        </section>

        {/* Right Form Side */}
        <section className="col-span-12 md:col-span-7 p-6 sm:p-10 md:p-16 flex flex-col justify-center">
          {/* Progress Stepper */}
          <nav className="flex items-center gap-4 mb-8 sm:mb-12">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 'business'
                  ? 'bg-[#070235] text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}>
                1
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Store Info</span>
            </div>
            <div className="w-8 h-px bg-gray-300 dark:bg-gray-600" />
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 'category'
                  ? 'bg-[#070235] text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}>
                2
              </div>
              <span className={`text-sm font-medium ${
                step === 'category'
                  ? 'text-gray-900 dark:text-gray-100'
                  : 'text-gray-400'
              }`}>Preferences</span>
            </div>
          </nav>

          <header className="mb-6 sm:mb-10">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {step === 'business' ? 'Initialize Your Business' : 'Choose a Category'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {step === 'business'
                ? 'Provide your basic business details to personalize your dashboard.'
                : 'Select a category to organize your products.'}
            </p>
          </header>

          {step === 'business' ? (
            <form onSubmit={handleBusinessSubmit} className="space-y-8">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">
                  Business Name
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  placeholder="e.g. Blue Horizon Boutique"
                  autoFocus
                  className="w-full bg-gray-100 dark:bg-gray-700 border-none rounded-lg px-4 py-4 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:ring-2 focus:ring-[#070235]/20 focus:bg-white dark:focus:bg-gray-600 transition-all"
                />
              </div>

              <div className="pt-6 flex flex-col gap-4">
                <button
                  type="submit"
                  disabled={!businessName.trim()}
                  className="w-full bg-[#070235] hover:bg-[#3d3dcb] text-white py-4 rounded-full font-bold text-base shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                  <span className="text-lg">→</span>
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="text-center text-xs text-gray-400 uppercase tracking-widest font-medium hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCategorySubmit} className="space-y-8">
              <div className="space-y-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">
                  First Category
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {categoryOptions.map(cat => (
                    <label
                      key={cat.name}
                      className={`group cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col gap-3 ${
                        categoryName === cat.name
                          ? 'border-[#070235] bg-[#070235]/5 dark:bg-[#070235]/10'
                          : 'border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="category"
                        value={cat.name}
                        checked={categoryName === cat.name}
                        onChange={e => setCategoryName(e.target.value)}
                        className="hidden"
                      />
                      <span className="text-2xl">{cat.icon}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{cat.name}</span>
                    </label>
                  ))}
                  <label
                    className={`group cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col gap-3 ${
                      categoryName === 'Other'
                        ? 'border-[#070235] bg-[#070235]/5 dark:bg-[#070235]/10'
                        : 'border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="category"
                      value="Other"
                      checked={categoryName === 'Other'}
                      onChange={() => setCategoryName('')}
                      className="hidden"
                    />
                    <span className="text-2xl">⋯</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Custom</span>
                  </label>
                </div>
                {categoryName === '' && (
                  <input
                    type="text"
                    placeholder="Enter custom category..."
                    autoFocus
                    className="w-full bg-gray-100 dark:bg-gray-700 border-none rounded-lg px-4 py-3 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:ring-2 focus:ring-[#070235]/20 transition-all"
                    onChange={e => setCategoryName(e.target.value)}
                  />
                )}
              </div>

              <div className="pt-6 flex flex-col gap-4">
                <button
                  type="submit"
                  disabled={!categoryName.trim() || isPending}
                  className="w-full bg-[#070235] hover:bg-[#3d3dcb] text-white py-4 rounded-full font-bold text-base shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? <Spinner size="sm" className="text-white" /> : (
                    <>
                      Continue to Dashboard
                      <span className="text-lg">→</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="text-center text-xs text-gray-400 uppercase tracking-widest font-medium hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </form>
          )}
        </section>
      </div>

      {/* Footer Meta */}
      <footer className="hidden sm:flex fixed bottom-6 left-1/2 -translate-x-1/2 items-center gap-6 opacity-40">
        <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-500">Precision</span>
        <div className="w-1 h-1 rounded-full bg-gray-400" />
        <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-500">Elegance</span>
        <div className="w-1 h-1 rounded-full bg-gray-400" />
        <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-500">Flow</span>
      </footer>
    </div>
  )
}
