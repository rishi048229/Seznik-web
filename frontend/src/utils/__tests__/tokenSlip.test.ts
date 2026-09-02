import { describe, it, expect } from 'vitest'
import {
  TOKEN_SLIP_TEMPLATES,
  composeTokenSlipHTML,
  composeTokenSlipEscPos,
  centerRasterOnPaper,
  resolveTokenTemplate,
} from '../tokenSlip'
import { TOKEN_ICON_ASSETS } from '../tokenIconAssets'

const sampleToken = {
  tokenNumber: 2,
  typeName: 'Chai Token',
  icon: 'chai',
  amount: 25.2,
  qty: 2,
  time: '2026-09-01T11:30:00.000Z',
  businessName: 'Seznik India',
  paymentMethod: 'cash',
}

const fakeIcon = (widthBytes: number, heightDots: number) => {
  const packed = new Uint8Array(widthBytes * heightDots)
  packed[0] = 0xff
  packed[packed.length - 1] = 0x80
  return { packed, widthBytes, heightDots }
}

describe('token slip templates', () => {
  it('registers 16 samples each with iconAssetKey and footerMessage', () => {
    expect(TOKEN_SLIP_TEMPLATES).toHaveLength(16)
    for (const tpl of TOKEN_SLIP_TEMPLATES) {
      expect(tpl.iconAssetKey).toBeTruthy()
      expect(TOKEN_ICON_ASSETS[tpl.iconAssetKey]).toContain('<svg')
      expect(tpl.footerMessage.length).toBeGreaterThan(3)
    }
  })

  it('looks up chai, parking, and ice cream from the same registry', () => {
    expect(resolveTokenTemplate('chai').id).toBe('chai')
    expect(resolveTokenTemplate('parking').footerMessage).toBe('Keep this slip')
    expect(resolveTokenTemplate('icecream').iconAssetKey).toBe('icecream')
  })
})

describe('unified slip renderer', () => {
  it('HTML uses a bitmap img, not ASCII cup glyphs', () => {
    const html = composeTokenSlipHTML(resolveTokenTemplate('chai'), sampleToken)
    expect(html).toContain('<img')
    expect(html).toContain('data:image/svg+xml')
    expect(html).not.toMatch(/\( \(/)
    expect(html).not.toContain('|        |]')
    expect(html).toContain('Enjoy your chai')
    expect(html).toContain('Seznik India')
  })

  it('ESC/POS for chai, parking, and ice cream shares layout and emits GS v 0', () => {
    const paper = '58mm' as const
    const ids = ['chai', 'parking', 'icecream'] as const
    const payloads = ids.map((id) => {
      const tpl = resolveTokenTemplate(id)
      const icon = centerRasterOnPaper(fakeIcon(16, 24), 384)
      expect(icon.widthBytes).toBe(48)
      const bytes = composeTokenSlipEscPos(
        tpl,
        { ...sampleToken, typeName: tpl.name, icon: id, amount: id === 'parking' ? 50 : sampleToken.amount },
        paper,
        icon,
      )
      return { id, tpl, bytes }
    })

    for (const { bytes, tpl } of payloads) {
      const gsV0 = bytes.findIndex(
        (_, i) => bytes[i] === 0x1d && bytes[i + 1] === 0x76 && bytes[i + 2] === 0x30,
      )
      expect(gsV0).toBeGreaterThan(0)
      const text = new TextDecoder('latin1').decode(bytes)
      expect(text).toContain(tpl.footerMessage)
      expect(text).toContain('TOKEN')
      expect(text).not.toContain('( (')
    }

    expect(payloads[0].bytes.length).toBeGreaterThan(80)
    expect(Math.abs(payloads[0].bytes.length - payloads[1].bytes.length)).toBeLessThan(40)
  })

  it('every sample template uses the same HTML slip path with an SVG icon', () => {
    for (const tpl of TOKEN_SLIP_TEMPLATES) {
      const html = composeTokenSlipHTML(tpl, { ...sampleToken, typeName: tpl.name, icon: tpl.id })
      expect(html).toContain('<img')
      expect(html).toContain('data:image/svg+xml')
      expect(html).toContain(tpl.footerMessage.replace(/&/g, '&amp;'))
      expect(html).not.toMatch(/\( \(/)
    }
  })
})
