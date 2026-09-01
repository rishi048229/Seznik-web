import { type ReactNode } from 'react'
import { Footer } from './Footer'

interface AppLayoutProps {
  sidebar: ReactNode
  topbar: ReactNode
  children: ReactNode
}

export const AppLayout = ({ sidebar, topbar, children }: AppLayoutProps) => {
  return (
    <div className="flex h-[100dvh] bg-gray-50 dark:bg-gray-900">
      {sidebar}
      <div className="flex-1 flex flex-col overflow-hidden">
        {topbar}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:pb-6 flex flex-col justify-between min-w-0">
          <div className="flex-1 min-w-0 max-w-full">{children}</div>
          <Footer />
        </main>
      </div>
    </div>
  )
}
