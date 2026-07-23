import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import { StatsBar } from './components/StatsBar'
import { Services } from './components/Services'
import { WebsiteOverview } from './components/WebsiteOverview'
import { FreeFeatures } from './components/FreeFeatures'
import { PrintersShowcase } from './components/PrintersShowcase'
import { HowItWorks } from './components/HowItWorks'
import { ComingSoonApps } from './components/ComingSoonApps'
import { Reviews } from './components/Reviews'
import { FinalCTA } from './components/FinalCTA'
import { Footer } from './components/Footer'
import { ScrollProgressBar } from './components/ScrollProgressBar'

export const LandingPage = () => {
  return (
    <div className="relative w-full overflow-x-hidden">
      <ScrollProgressBar />
      <Navbar />
      <Hero />
      <StatsBar />
      <Services />
      <WebsiteOverview />
      <FreeFeatures />
      <PrintersShowcase />
      <HowItWorks />
      <ComingSoonApps />
      <Reviews />
      <FinalCTA />
      <Footer />
    </div>
  )
}
