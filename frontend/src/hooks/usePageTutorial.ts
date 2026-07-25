import { useState, useEffect } from 'react'
import { PAGE_TUTORIALS, type PageTutorialData } from '@/data/pageTutorials'

export const usePageTutorial = (pageKey: string) => {
  const [isTutorialOpen, setIsTutorialOpen] = useState(false)
  const [isTourOpen, setIsTourOpen] = useState(false)

  const tutorialData: PageTutorialData = PAGE_TUTORIALS[pageKey] || PAGE_TUTORIALS.dashboard

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storageKey = `seznik_tour_completed_${pageKey}`
    const completed = localStorage.getItem(storageKey)
    if (!completed) {
      // Auto-trigger the tour once, for a first-time visitor. We mark it seen
      // right here — not when the user finishes/skips it — so navigating away
      // mid-tour (e.g. clicking a sidebar link) can't make it reappear on the
      // next visit. Users can always replay it manually via the guide button.
      localStorage.setItem(storageKey, 'true')
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
