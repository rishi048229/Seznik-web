import { useRef, useCallback } from 'react'

export const usePrint = () => {
  const componentRef = useRef<HTMLDivElement>(null)

  const handlePrint = useCallback(() => {
    if (componentRef.current) {
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head><title>Print</title></head>
            <body>${componentRef.current.innerHTML}</body>
          </html>
        `)
        printWindow.document.close()
        printWindow.print()
      }
    }
  }, [])

  return { componentRef, handlePrint }
}
