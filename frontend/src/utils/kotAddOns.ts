/** Priced add-ons are stored in KOT line `modifiers` with prefix `addon|`. Kitchen-only mods are plain strings. */

export const ADDON_MODIFIER_PREFIX = 'addon|'

export type KotPricedAddOn = {
  productId?: string
  name: string
  price: number
}

export function encodeAddOnModifier(addOn: KotPricedAddOn): string {
  const name = String(addOn.name || '').replace(/\|/g, '/').trim()
  const price = Math.max(0, Number(addOn.price) || 0)
  const pid = addOn.productId ? String(addOn.productId) : ''
  return `${ADDON_MODIFIER_PREFIX}${pid}|${name}|${price.toFixed(2)}`
}

export function parseAddOnModifier(mod: string): KotPricedAddOn | null {
  if (!mod.startsWith(ADDON_MODIFIER_PREFIX)) return null
  const rest = mod.slice(ADDON_MODIFIER_PREFIX.length)
  const parts = rest.split('|')
  if (parts.length < 2) return null
  const pricePart = parts[parts.length - 1]
  const price = Number(pricePart)
  const name = parts.length >= 3 ? parts.slice(1, -1).join('|') : parts[0]
  const productId = parts.length >= 3 ? parts[0] || undefined : undefined
  if (!name.trim() || !Number.isFinite(price)) return null
  return { productId: productId || undefined, name: name.trim(), price: Math.max(0, price) }
}

export function splitKotModifiers(modifiers: string[] | null | undefined): {
  kitchen: string[]
  addOns: KotPricedAddOn[]
} {
  const kitchen: string[] = []
  const addOns: KotPricedAddOn[] = []
  for (const mod of modifiers ?? []) {
    const addOn = parseAddOnModifier(mod)
    if (addOn) addOns.push(addOn)
    else if (mod.trim()) kitchen.push(mod.trim())
  }
  return { kitchen, addOns }
}

export function addOnTotalPerUnit(modifiers: string[] | null | undefined): number {
  const { addOns } = splitKotModifiers(modifiers)
  return addOns.reduce((s, a) => s + a.price, 0)
}

export function kotLineSubtotal(item: {
  quantity: number
  unitPrice: number
  modifiers?: string[] | null
}): number {
  const qty = Math.max(0, Number(item.quantity) || 0)
  const unit = Number(item.unitPrice) || 0
  return qty * (unit + addOnTotalPerUnit(item.modifiers))
}

export function formatAddOnsForDisplay(modifiers: string[] | null | undefined): string {
  const { addOns } = splitKotModifiers(modifiers)
  if (!addOns.length) return ''
  return addOns.map((a) => `${a.name} (+₹${a.price.toFixed(0)})`).join(', ')
}

export function kitchenModifiersForSlip(modifiers: string[] | null | undefined): string[] {
  const { kitchen, addOns } = splitKotModifiers(modifiers)
  return [...kitchen, ...addOns.map((a) => `+ ${a.name}`)]
}
