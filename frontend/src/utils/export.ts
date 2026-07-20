import * as XLSX from 'xlsx'

export const exportToExcel = <T extends Record<string, unknown>>(data: T[], filename: string): void => {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
