export const isCancelledSale = (sale: { status?: string | null } | null | undefined): boolean =>
  (sale?.status || '').toLowerCase() === 'cancelled'

export const completedSales = <T extends { status?: string | null }>(sales: T[] | null | undefined): T[] =>
  (sales ?? []).filter((sale) => !isCancelledSale(sale))
