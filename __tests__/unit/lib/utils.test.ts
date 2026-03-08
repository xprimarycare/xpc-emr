import { cn } from '@/lib/utils'

describe('cn', () => {
  it('passes through a single class', () => {
    expect(cn('px-2')).toBe('px-2')
  })

  it('merges multiple classes', () => {
    expect(cn('px-2', 'py-3')).toBe('px-2 py-3')
  })

  it('resolves conflicting Tailwind classes (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('handles conditional classes via object syntax', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active')
  })

  it('filters out falsy values', () => {
    expect(cn('a', undefined, null, false, 'b')).toBe('a b')
  })

  it('handles empty input', () => {
    expect(cn()).toBe('')
  })
})
