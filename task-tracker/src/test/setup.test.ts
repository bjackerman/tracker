// Smoke test to verify the test setup is working
import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('Test setup', () => {
  it('vitest globals and jsdom are configured', () => {
    expect(typeof document).toBe('object')
  })

  it('cn utility function works', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('@testing-library/jest-dom matchers are available', () => {
    const el = document.createElement('div')
    el.textContent = 'hello'
    document.body.appendChild(el)
    expect(el).toBeInTheDocument()
    document.body.removeChild(el)
  })
})
