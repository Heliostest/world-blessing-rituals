import { describe, it, expect } from 'vitest'
import { assertSafeCopy, FORBIDDEN_SUCCESS_PHRASES } from './disclaimers'

describe('assertSafeCopy', () => {
  it('throws on 通关', () => {
    expect(() => assertSafeCopy('本关通关')).toThrow(/forbidden/i)
  })
  it('allows 手势练习', () => {
    expect(() => assertSafeCopy('这是手势练习')).not.toThrow()
  })
  it('lists known phrases', () => {
    expect(FORBIDDEN_SUCCESS_PHRASES).toEqual(
      expect.arrayContaining(['参拜成功', '作福完成', '通关', '功德'])
    )
  })
})
