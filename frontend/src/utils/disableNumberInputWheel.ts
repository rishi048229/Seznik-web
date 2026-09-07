/** Stops mouse-wheel from changing focused/hovered number inputs. Typing and spinner arrows still work. */
export function installNumberInputWheelGuard() {
  const onWheel = (event: WheelEvent) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    const input = target instanceof HTMLInputElement ? target : target.closest('input')
    if (!(input instanceof HTMLInputElement) || input.type !== 'number') return
    event.preventDefault()
  }

  document.addEventListener('wheel', onWheel, { passive: false })
  return () => document.removeEventListener('wheel', onWheel)
}
