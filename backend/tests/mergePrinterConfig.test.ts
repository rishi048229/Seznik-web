import { mergePrinterConfig, resolveThermalPaper } from '../src/utils/mergePrinterConfig'

function assert(cond: unknown, msg?: string) {
  if (!cond) throw new Error(msg || 'Assertion failed')
}

const existing = {
  paperWidth: '58mm',
  printCopies: 2,
  autoCut: false,
  topMargin: 3,
  printDensity: 8,
  labelTemplate: [{ id: 'el-1' }],
  invoiceColorTheme: 'navy',
}

const webPatch = {
  paperSize: '80mm',
  connectionType: 'bluetooth',
  fontSize: 'large',
}

const merged = mergePrinterConfig(existing, webPatch)
assert(merged.paperSize === '80mm', 'web paperSize applied')
assert(merged.paperWidth === '80mm', 'paperWidth mirrored from paperSize')
assert(merged.printCopies === 2, 'mobile copies preserved')
assert(merged.autoCut === false, 'mobile autoCut preserved')
assert(merged.topMargin === 3, 'mobile topMargin preserved')
assert(merged.printDensity === 8, 'mobile density preserved')
assert(merged.invoiceColorTheme === 'navy', 'web A4 theme preserved when not in patch')
assert(merged.connectionType === 'bluetooth', 'web connectionType applied')
assert(Array.isArray(merged.labelTemplate) && (merged.labelTemplate as { id: string }[])[0].id === 'el-1', 'label template preserved')

const reverse = mergePrinterConfig(merged, { paperWidth: '58mm', printCopies: 3 })
assert(reverse.paperWidth === '58mm', 'mobile paperWidth applied')
assert(reverse.paperSize === '58mm', 'paperSize mirrored from paperWidth')
assert(reverse.printCopies === 3, 'copies updated')
assert(reverse.connectionType === 'bluetooth', 'web connectionType kept')
assert(reverse.invoiceColorTheme === 'navy', 'A4 theme kept after mobile save')

assert(resolveThermalPaper({ paperSize: '80mm' }) === '80mm', 'resolve from paperSize')
assert(resolveThermalPaper({ paperWidth: '58mm', paperSize: '80mm' }) === '58mm', 'paperWidth wins when both present')

console.log('mergePrinterConfig tests passed')
