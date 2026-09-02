/** Monochrome line-art SVGs for thermal token slips. Keyed by iconAssetKey. */

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none">${body}</svg>`

const st = 'stroke="#000" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"'

export const TOKEN_ICON_ASSETS: Record<string, string> = {
  chai: svg(`
    <path d="M22 16c0 4 3 4 3 8" ${st}/>
    <path d="M30 14c0 4 3 4 3 8" ${st}/>
    <path d="M16 26h24v10a12 12 0 0 1-24 0V26z" ${st}/>
    <path d="M40 30h7a7 7 0 0 1 0 14h-5" ${st}/>
    <path d="M18 50h20" ${st}/>
  `),
  coffee: svg(`
    <path d="M18 22h24v12a12 12 0 0 1-24 0V22z" ${st}/>
    <path d="M42 26h6a7 7 0 1 1 0 14h-4" ${st}/>
    <path d="M16 50h28" ${st}/>
    <path d="M20 50c2 6 18 6 20 0" ${st}/>
  `),
  lassi: svg(`
    <path d="M22 12h20l-3 36a9 9 0 0 1-18 0L22 12z" ${st}/>
    <path d="M24 22h16" ${st}/>
    <path d="M32 12v6" ${st}/>
  `),
  water: svg(`
    <path d="M32 10c0 0-16 20-16 30a16 16 0 0 0 32 0C48 30 32 10 32 10z" ${st}/>
    <path d="M26 38c2 6 10 6 12 0" ${st}/>
  `),
  samosa: svg(`
    <path d="M32 10 L54 50 H10 Z" ${st}/>
    <path d="M22 42 L32 22 L42 42" ${st}/>
  `),
  vadapav: svg(`
    <path d="M14 28c0-8 8-12 18-12s18 4 18 12v4H14v-4z" ${st}/>
    <path d="M16 32h32v8H16z" ${st}/>
    <path d="M14 40h36c0 8-8 12-18 12s-18-4-18-12z" ${st}/>
  `),
  icecream: svg(`
    <circle cx="32" cy="18" r="8" ${st}/>
    <circle cx="24" cy="26" r="7" ${st}/>
    <circle cx="40" cy="26" r="7" ${st}/>
    <path d="M20 32h24L34 56h-4L20 32z" ${st}/>
  `),
  bakery: svg(`
    <path d="M14 40c2-16 10-22 18-22s16 6 18 22" ${st}/>
    <path d="M14 40c4 8 28 8 36 0" ${st}/>
    <path d="M24 28c2 4 4 4 6 0" ${st}/>
    <path d="M34 26c2 4 4 4 6 0" ${st}/>
  `),
  thali: svg(`
    <circle cx="32" cy="34" r="20" ${st}/>
    <circle cx="32" cy="34" r="6" ${st}/>
    <circle cx="22" cy="26" r="4" ${st}/>
    <circle cx="42" cy="26" r="4" ${st}/>
    <circle cx="22" cy="42" r="4" ${st}/>
    <circle cx="42" cy="42" r="4" ${st}/>
  `),
  canteen: svg(`
    <path d="M10 22h44v6H10z" ${st}/>
    <path d="M14 28h36v20H14z" ${st}/>
    <path d="M18 34h12v10H18z" ${st}/>
    <path d="M34 34h12v10H34z" ${st}/>
  `),
  parking: svg(`
    <circle cx="32" cy="32" r="22" ${st}/>
    <path d="M24 20v24M24 20h10a8 8 0 0 1 0 16H24" ${st}/>
  `),
  valet: svg(`
    <circle cx="22" cy="24" r="8" ${st}/>
    <path d="M28 28 L48 48" ${st}/>
    <path d="M42 42 h8" ${st}/>
    <path d="M46 46 h8" ${st}/>
  `),
  bike: svg(`
    <circle cx="18" cy="44" r="10" ${st}/>
    <circle cx="46" cy="44" r="10" ${st}/>
    <path d="M18 44 L28 24 h12 L46 44" ${st}/>
    <path d="M28 24 L22 24" ${st}/>
    <path d="M32 24 v8" ${st}/>
  `),
  cloak: svg(`
    <path d="M16 20h32" ${st}/>
    <path d="M32 12v8" ${st}/>
    <path d="M20 20 L16 52" ${st}/>
    <path d="M44 20 L48 52" ${st}/>
    <path d="M16 52h32" ${st}/>
  `),
  laundry: svg(`
    <path d="M20 18 L32 14 L44 18 L40 52 H24 Z" ${st}/>
    <path d="M24 18 L24 26 h16 v-8" ${st}/>
  `),
  queue: svg(`
    <path d="M16 12h32v40H16z" ${st}/>
    <path d="M22 22h20" ${st}/>
    <path d="M22 32h20" ${st}/>
    <path d="M22 42h12" ${st}/>
  `),
  ticket: svg(`
    <path d="M12 20h40v24H12z" ${st}/>
    <path d="M52 28a4 4 0 0 0 0 8" ${st}/>
    <path d="M12 28a4 4 0 0 1 0 8" ${st}/>
    <path d="M22 28v8" ${st}/>
  `),
}

export const tokenIconDataUri = (iconAssetKey: string): string => {
  const svgXml = TOKEN_ICON_ASSETS[iconAssetKey] || TOKEN_ICON_ASSETS.ticket
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgXml)}`
}
