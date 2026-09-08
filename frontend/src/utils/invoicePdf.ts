const PAPER_PT = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
} as const

const PX_PER_MM = 96 / 25.4

export function toPdfFilename(name: string): string {
  const trimmed = (name || 'invoice').replace(/\.pdf$/i, '').trim() || 'invoice'
  const safe = trimmed.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 120)
  return `${safe}.pdf`
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function waitForImage(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve()
  return new Promise(resolve => {
    img.onload = () => resolve()
    img.onerror = () => resolve()
  })
}

async function inlineImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    imgs.map(async img => {
      const src = img.currentSrc || img.getAttribute('src') || ''
      if (!src || src.startsWith('data:')) {
        await waitForImage(img)
        return
      }
      try {
        const res = await fetch(src, { mode: 'cors' })
        if (!res.ok) {
          await waitForImage(img)
          return
        }
        img.src = await blobToDataUrl(await res.blob())
        await waitForImage(img)
      } catch {
        await waitForImage(img)
      }
    }),
  )
}

function triggerPdfDownload(bytes: Uint8Array, filename: string) {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const blob = new Blob([copy.buffer as ArrayBuffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/**
 * Renders the invoice HTML and downloads a real PDF file.
 * Must never call window.print() — that opens the browser print dialog.
 */
export async function downloadA4InvoicePdf(
  innerHtml: string,
  filename: string,
  paper: 'A4' | 'Letter' = 'A4',
): Promise<void> {
  if (typeof document === 'undefined') {
    throw new Error('PDF download is only available in the browser')
  }

  const [{ toPng }, { PDFDocument }] = await Promise.all([
    import('html-to-image'),
    import('pdf-lib'),
  ])

  const page = PAPER_PT[paper]
  const widthMm = paper === 'Letter' ? 215.9 : 210
  const widthPx = Math.round(widthMm * PX_PER_MM)
  const padPx = Math.round(10 * PX_PER_MM)

  const host = document.createElement('div')
  host.setAttribute('data-invoice-pdf-root', 'true')
  host.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${widthPx}px`,
    `padding:${padPx}px`,
    'box-sizing:border-box',
    'background:#ffffff',
    'color:#111111',
    'font-family:Arial,Helvetica,sans-serif',
    'z-index:2147483646',
    'pointer-events:none',
    'opacity:0',
  ].join(';')
  host.innerHTML = innerHtml
  document.body.appendChild(host)

  try {
    await inlineImages(host)
    if (document.fonts?.ready) await document.fonts.ready
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })

    // Opacity 0 can make some capture engines skip pixels; clone as fully opaque.
    const pixelRatio = window.innerWidth < 768 ? 2 : 3
    const pngDataUrl = await toPng(host, {
      pixelRatio,
      cacheBust: true,
      backgroundColor: '#ffffff',
      style: { opacity: '1', left: '0', top: '0' },
    })

    const pngBytes = await fetch(pngDataUrl).then(res => res.arrayBuffer())
    const pdf = await PDFDocument.create()
    const image = await pdf.embedPng(pngBytes)
    const drawWidth = page.width
    const drawHeight = (image.height / image.width) * page.width
    const pageCount = Math.max(1, Math.ceil(drawHeight / page.height - 1e-6))

    for (let i = 0; i < pageCount; i++) {
      const pdfPage = pdf.addPage([page.width, page.height])
      pdfPage.drawImage(image, {
        x: 0,
        y: page.height - drawHeight + i * page.height,
        width: drawWidth,
        height: drawHeight,
      })
    }

    const bytes = await pdf.save()
    triggerPdfDownload(bytes, toPdfFilename(filename))
  } finally {
    host.remove()
  }
}
