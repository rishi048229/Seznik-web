export const formatInvoiceNumber = (count: number, prefix = 'INV'): string => {
  return `${prefix}-${String(count).padStart(5, '0')}`
}

export const generateSKU = (categoryPrefix: string, number: number): string => {
  return `${categoryPrefix}-${String(number).padStart(4, '0')}`
}
