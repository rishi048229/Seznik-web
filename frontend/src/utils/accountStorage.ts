const accountKey = (base: string, userId: string) => `${base}:${userId}`

export function readAccountJson<T>(baseKey: string, userId: string | undefined): T | undefined {
  if (!userId) return undefined
  try {
    const raw = localStorage.getItem(accountKey(baseKey, userId))
    if (!raw) return undefined
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

export function writeAccountJson(baseKey: string, userId: string | undefined, value: unknown) {
  if (!userId) return
  try {
    localStorage.setItem(accountKey(baseKey, userId), JSON.stringify(value))
  } catch {
    // quota / private mode — ignore
  }
}

type OwnedItem = { productId?: string; id?: string }

function catalogId(item: OwnedItem): string | undefined {
  if (item.productId) return item.productId
  if (item.id && !item.id.startsWith('temp-')) return item.id
  return undefined
}

function keepOwned<T extends OwnedItem>(items: T[], ownedIds: Set<string>): T[] {
  return items.filter(item => {
    const id = catalogId(item)
    return !id || ownedIds.has(id)
  })
}

/**
 * Legacy keys (no user id) must not leak into a new account.
 * Only adopt them when at least one product id belongs to this shop.
 */
export function adoptLegacyJson<T extends OwnedItem>(
  baseKey: string,
  userId: string | undefined,
  ownedIds: Set<string>,
  fallback: T[]
): T[] {
  if (!userId) return fallback
  const namespaced = readAccountJson<T[]>(baseKey, userId)
  if (namespaced !== undefined) {
    return keepOwned(namespaced, ownedIds)
  }

  try {
    const raw = localStorage.getItem(baseKey)
    if (!raw) return fallback
    const legacy = JSON.parse(raw) as T[]
    if (!Array.isArray(legacy) || legacy.length === 0) return fallback
    const belongsHere = legacy.some(item => {
      const id = catalogId(item)
      return Boolean(id && ownedIds.has(id))
    })
    if (!belongsHere) return fallback
    const owned = keepOwned(legacy, ownedIds)
    writeAccountJson(baseKey, userId, owned)
    localStorage.removeItem(baseKey)
    return owned
  } catch {
    return fallback
  }
}
