import { useState, useEffect } from 'react'
import { PAGE_TUTORIALS, type PageTutorialData } from '@/data/pageTutorials'

export const usePageTutorial = (pageKey: string) => {
  const [isTutorialOpen, setIsTutorialOpen] = useState(false)
  const [isTourOpen, setIsTourOpen] = useState(false)

  const tutorialData: PageTutorialData = PAGE_TUTORIALS[pageKey] || PAGE_TUTORIALS.dashboard

  useEffect(() => {
    if (typeof window === 'undefined') return
    const completed = localStorage.getItem(`seznik_tour_completed_${pageKey}`)
    if (!completed) {
      // Auto-trigger interactive tour for first-time onboarding
      const timer = setTimeout(() => {
        setIsTourOpen(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [pageKey])

  return {
    tutorialData,
    isTutorialOpen,
    openTutorial: () => setIsTutorialOpen(true),
    closeTutorial: () => setIsTutorialOpen(false),
    isTourOpen,
    startTour: () => setIsTourOpen(true),
    closeTour: () => setIsTourOpen(false),
  }
}
