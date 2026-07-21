// Minimal ESC/POS command builder for 58mm (32 character wide) thermal printers.

const ESC = 0x1b
const GS = 0x1d

export type EscPosAlign = 'left' | 'center' | 'right'

// Printers on this command set generally only ship an 8-bit ASCII/CP437-ish
// code page, so non-ASCII characters (₹, etc.) are swapped for safe equivalents
// rather than risking mojibake on the receipt.
function toPrinterSafeText(str: string): string {
  const withoutRupee = str.replace(/₹/g, 'Rs.')
  let result = ''
  for (const ch of withoutRupee) {
    result += ch.codePointAt(0)! <= 0x7f ? ch : '?'
  }
  return result
}

export class EscPosBuilder {
  private bytes: number[] = []

  private push(...values: number[]): this {
    this.bytes.push(...values)
    return this
  }

  init(): this {
    return this.push(ESC, 0x40)
  }

  align(align: EscPosAlign): this {
    const n = align === 'center' ? 1 : align === 'right' ? 2 : 0
    return this.push(ESC, 0x61, n)
  }

  bold(on: boolean): this {
    return this.push(ESC, 0x45, on ? 1 : 0)
  }

  doubleSize(on: boolean): this {
    return this.push(GS, 0x21, on ? 0x11 : 0x00)
  }

  text(str: string): this {
    const safe = toPrinterSafeText(str)
    for (let i = 0; i < safe.length; i++) {
      this.bytes.push(safe.charCodeAt(i) & 0xff)
    }
    return this
  }

  line(str = ''): this {
    return this.text(str).newline()
  }

  newline(count = 1): this {
    for (let i = 0; i < count; i++) this.push(0x0a)
    return this
  }

  hr(width = 32, char = '-'): this {
    return this.line(char.repeat(width))
  }

  // Pads two strings to the given width, left-justified and right-justified.
  twoCol(left: string, right: string, width = 32): this {
    const space = Math.max(1, width - left.length - right.length)
    return this.line(left + ' '.repeat(space) + right)
  }

  feed(lines = 3): this {
    return this.push(ESC, 0x64, lines)
  }

  cut(): this {
    return this.push(GS, 0x56, 0x01)
  }

  toBytes(): Uint8Array {
    return new Uint8Array(this.bytes)
  }
}
