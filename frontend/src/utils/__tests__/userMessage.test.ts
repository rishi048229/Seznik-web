import { describe, expect, it } from 'vitest'
import { isCancelledAction, toUserMessage } from '../userMessage'

describe('toUserMessage', () => {
  it('hides Prisma / column errors behind a simple fallback', () => {
    const err = new Error('Failed to update settings: Unknown argument `kotConfig`. Available arguments are listed in the docs.')
    expect(toUserMessage(err, 'Could not save settings')).toBe('Could not save settings')
  })

  it('hides missing-column SQL text', () => {
    const err = new Error('column "kotConfig" does not exist')
    expect(toUserMessage(err)).toBe('Something went wrong. Please try again.')
  })

  it('keeps short, already-friendly messages', () => {
    expect(toUserMessage(new Error('Invalid email or password'), 'Sign in failed')).toBe('Invalid email or password')
  })

  it('maps network failures', () => {
    expect(toUserMessage(new Error('Failed to fetch'))).toBe('Check your internet connection and try again.')
  })

  it('treats Bluetooth chooser cancel as cancelled, not a crash', () => {
    const err = Object.assign(new Error('User cancelled the requestDevice() chooser.'), { name: 'NotFoundError' })
    expect(isCancelledAction(err)).toBe(true)
    expect(toUserMessage(err)).toBe('Printer pairing was cancelled.')
  })
})
