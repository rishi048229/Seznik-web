const { mergeReceiptConfig, mergeCustomTemplates } = require('../dist/utils/mergeReceiptConfig')

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed')
}

const existing = {
  companyName: 'Old Shop',
  showTaxBreakdown: true,
  customTemplates: [
    { id: 'a', name: 'A', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'b', name: 'B', updatedAt: '2026-01-01T00:00:00.000Z' },
  ],
  activeCustomTemplateId: 'a',
}

const patch = {
  companyName: 'New Shop',
  customTemplates: [
    { id: 'a', name: 'A Updated', updatedAt: '2026-02-01T00:00:00.000Z' },
    { id: 'c', name: 'C', updatedAt: '2026-02-01T00:00:00.000Z' },
  ],
}

const merged = mergeReceiptConfig(existing, patch)
assert(merged.companyName === 'New Shop', 'scalar patch wins')
assert(merged.showTaxBreakdown === true, 'untouched scalar preserved')
assert(merged.customTemplates.length === 3, 'templates merged by id')
assert(merged.customTemplates.find((t) => t.id === 'a')?.name === 'A Updated', 'newer template wins')
assert(merged.customTemplates.find((t) => t.id === 'b')?.name === 'B', 'unchanged template kept')
assert(merged.customTemplates.find((t) => t.id === 'c')?.name === 'C', 'new template added')

const deleted = mergeReceiptConfig(existing, {
  deletedTemplateIds: ['b'],
  customTemplates: [],
})
assert(deleted.customTemplates.length === 1, 'deleted template removed')
assert(!deleted.customTemplates.find((t) => t.id === 'b'), 'b gone')

console.log('mergeReceiptConfig tests passed')
