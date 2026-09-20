export const COMPLETED_SALE_WHERE = {
  status: { not: 'cancelled' as const },
}
