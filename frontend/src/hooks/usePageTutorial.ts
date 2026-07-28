import { useState } from 'react'
import { PAGE_TUTORIALS, type PageTutorialData } from '@/data/pageTutorials'

export const usePageTutorial = (pageKey: string) => {
  const [isTutorialOpen, setIsTutorialOpen] = useState(false)
  const [isTourOpen, setIsTourOpen] = useState(false)

  const tutorialData: PageTutorialData = PAGE_TUTORIALS[pageKey] || PAGE_TUTORIALS.dashboard

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
