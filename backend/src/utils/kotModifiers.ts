export const ADDON_MODIFIER_PREFIX = 'addon|'

export type KotPricedAddOn = {
  productId?: string
  name: string
  price: number
}

export function parseAddOnModifier(mod: string): KotPricedAddOn | null {
  if (!mod.startsWith(ADDON_MODIFIER_PREFIX)) return null
  const rest = mod.slice(ADDON_MODIFIER_PREFIX.length)
  const parts = rest.split('|')
  if (parts.length < 2) return null
  const price = Number(parts[parts.length - 1])
  const name = parts.length >= 3 ? parts.slice(1, -1).join('|') : parts[0]
  const productId = parts.length >= 3 ? parts[0] || undefined : undefined
  if (!name.trim() || !Number.isFinite(price)) return null
  return { productId: productId || undefined, name: name.trim(), price: Math.max(0, price) }
}

export function splitKotModifiers(modifiers: unknown): { kitchen: string[]; addOns: KotPricedAddOn[] } {
  const kitchen: string[] = []
  const addOns: KotPricedAddOn[] = []
  if (!Array.isArray(modifiers)) return { kitchen, addOns }
  for (const mod of modifiers) {
    if (typeof mod !== 'string') continue
    const addOn = parseAddOnModifier(mod)
    if (addOn) addOns.push(addOn)
    else if (mod.trim()) kitchen.push(mod.trim())
  }
  return { kitchen, addOns }
}

export function addOnTotalPerUnit(modifiers: unknown): number {
  const { addOns } = splitKotModifiers(modifiers)
  return addOns.reduce((s, a) => s + a.price, 0)
}

export function kotLineUnitPrice(baseUnit: number, modifiers: unknown): number {
  return (Number(baseUnit) || 0) + addOnTotalPerUnit(modifiers)
}

export function kotLineSubtotal(item: { quantity: number; unitPrice: number; modifiers?: unknown }): number {
  const qty = Math.max(0, Number(item.quantity) || 0)
  return qty * kotLineUnitPrice(item.unitPrice, item.modifiers)
}
