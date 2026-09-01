export const formatElapsed = (from: string | Date): string => {
  const start = typeof from === 'string' ? new Date(from).getTime() : from.getTime()
  const mins = Math.max(0, Math.floor((Date.now() - start) / 60000))
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export const formatSentTime = (from: string | Date): string => {
  const d = typeof from === 'string' ? new Date(from) : from
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export const ticketLaneLabel = (status?: string | null): string => {
  if (status === 'sent_to_kitchen' || status === 'preparing') return 'On the way'
  if (status === 'ready') return 'Ready'
  if (status === 'served') return 'Served'
  return 'Open'
}
