import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { RevealOnScroll } from './RevealOnScroll'
import { CapsuleButton } from './CapsuleButton'

export const FinalCTA = () => {
  const navigate = useNavigate()

  return (
    <section className="relative py-24 px-4 sm:px-6 bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(255,255,255,0.15),transparent)]" />
      <RevealOnScroll className="relative max-w-3xl mx-auto text-center">
        <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight leading-tight">
          Ready to run your store the easy way?
        </h2>
        <p className="mt-5 text-blue-50/90 text-base sm:text-lg max-w-xl mx-auto">
          Join hundreds of businesses already printing, selling and tracking stock with Seznik — completely free.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
          <CapsuleButton
            variant="dark"
            size="lg"
            rightIcon={<ArrowRight size={18} />}
            onClick={() => navigate(ROUTES.LOGIN)}
          >
            Create Your Free Account
          </CapsuleButton>
        </div>
      </RevealOnScroll>
    </section>
  )
}
