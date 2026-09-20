import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createWishWrite } from './wishWrite'

describe('createWishWrite', () => {
  let el: HTMLElement

  beforeEach(() => {
    el = document.createElement('div')
    document.body.appendChild(el)
  })

  afterEach(() => {
    el.remove()
  })

  it('mount creates a form with input and submit', () => {
    const g = createWishWrite({})
    g.mount(el, {})
    const form = el.querySelector('form')
    expect(form).toBeTruthy()
    expect(form!.querySelector('input')).toBeTruthy()
    expect(form!.querySelector('button[type="submit"], input[type="submit"]')).toBeTruthy()
    g.dispose()
    expect(el.querySelector('form')).toBeNull()
  })

  it('submits trimmed text via onSubmit', () => {
    const onSubmit = vi.fn()
    const g = createWishWrite({ onSubmit })
    g.mount(el, {})
    const input = el.querySelector('input') as HTMLInputElement
    input.value = '平安'
    el.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(onSubmit).toHaveBeenCalledWith('平安')
    g.dispose()
  })

  it('ignores empty / whitespace-only submit', () => {
    const onSubmit = vi.fn()
    const g = createWishWrite({ onSubmit })
    g.mount(el, {})
    const input = el.querySelector('input') as HTMLInputElement
    input.value = '   '
    el.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(onSubmit).not.toHaveBeenCalled()
    g.dispose()
  })

  it('ignores submit longer than maxLen after trim', () => {
    const onSubmit = vi.fn()
    const g = createWishWrite({ maxLen: 4, onSubmit })
    g.mount(el, {})
    const input = el.querySelector('input') as HTMLInputElement
    input.value = '一二三四五'
    el.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(onSubmit).not.toHaveBeenCalled()
    g.dispose()
  })

  it('trims surrounding whitespace before validate/submit', () => {
    const onSubmit = vi.fn()
    const g = createWishWrite({ maxLen: 40, onSubmit })
    g.mount(el, {})
    const input = el.querySelector('input') as HTMLInputElement
    input.value = '  平安  '
    el.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(onSubmit).toHaveBeenCalledWith('平安')
    g.dispose()
  })

  it('does not submit when disabled', () => {
    const onSubmit = vi.fn()
    const g = createWishWrite({ onSubmit })
    g.mount(el, {})
    g.setEnabled(false)
    const input = el.querySelector('input') as HTMLInputElement
    input.value = '平安'
    el.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(onSubmit).not.toHaveBeenCalled()
    g.dispose()
  })
})
