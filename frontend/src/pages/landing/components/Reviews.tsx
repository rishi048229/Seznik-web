import { Star, Quote } from 'lucide-react'
import { RevealOnScroll } from './RevealOnScroll'

interface Review {
  name: string
  business: string
  quote: string
  rating: number
}

const REVIEWS: Review[] = [
  {
    name: 'Ananya Rao',
    business: 'Owner, Rao General Store',
    quote:
      'We switched from three different tools to just Seznik. The Bluetooth printer pairing alone saved us an hour every day.',
    rating: 5,
  },
  {
    name: 'Farhan Sheikh',
    business: 'Manager, Sheikh Electronics',
    quote:
      'Every "premium" feature we used to pay for elsewhere — multi-store, reports, barcode — is just here by default. Wasn’t expecting that.',
    rating: 5,
  },
  {
    name: 'Priya Menon',
    business: 'Founder, The Fresh Aisle',
    quote:
      'Onboarding our staff took fifteen minutes. The label designer for the Veer printer is genuinely better than what we paid for before.',
    rating: 4,
  },
  {
    name: 'Devansh Patel',
    business: 'Co-founder, UrbanCart',
    quote:
      'Support actually responds. We had a tax report question at 11pm and someone helped us within the hour.',
    rating: 5,
  },
]

const initials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)

export const Reviews = () => {
  return (
    <section id="reviews" className="relative bg-slate-50 py-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <RevealOnScroll className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Loved By Businesses</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Don't just take our word for it
          </h2>
        </RevealOnScroll>

        <div className="grid sm:grid-cols-2 gap-6">
          {REVIEWS.map((review, i) => (
            <RevealOnScroll key={review.name} direction="up" delay={i * 0.08}>
              <div className="relative h-full rounded-2xl bg-white border border-slate-200 p-7 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <Quote className="absolute top-6 right-6 text-blue-100" size={36} />
                <div className="flex items-center gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star
                      key={idx}
                      size={15}
                      className={idx < review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}
                    />
                  ))}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed relative z-10">“{review.quote}”</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-sky-400 flex items-center justify-center text-white text-xs font-semibold">
                    {initials(review.name)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{review.name}</p>
                    <p className="text-xs text-slate-500">{review.business}</p>
                  </div>
                </div>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  )
}
