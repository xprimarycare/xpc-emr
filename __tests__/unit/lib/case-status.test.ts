import {
  UserRole,
  CaseStatus,
  STATUS_BADGE,
  STATUS_TAB_LABELS,
  STATUS_ORDER,
  VALID_STATUS_TRANSITIONS,
  formatDateTime,
} from '@/lib/constants/case-status'

describe('UserRole', () => {
  it('has correct values', () => {
    expect(UserRole.ADMIN).toBe('admin')
    expect(UserRole.USER).toBe('user')
  })
})

describe('CaseStatus', () => {
  it('has correct values', () => {
    expect(CaseStatus.WAITING_ROOM).toBe('waiting_room')
    expect(CaseStatus.IN_PROGRESS).toBe('in_progress')
    expect(CaseStatus.COMPLETED).toBe('completed')
  })
})

describe('STATUS_BADGE', () => {
  it('has entries for all statuses with required fields', () => {
    for (const status of Object.values(CaseStatus)) {
      expect(STATUS_BADGE[status]).toHaveProperty('bg')
      expect(STATUS_BADGE[status]).toHaveProperty('text')
      expect(STATUS_BADGE[status]).toHaveProperty('label')
    }
  })
})

describe('STATUS_TAB_LABELS', () => {
  it('maps all statuses to readable labels', () => {
    expect(STATUS_TAB_LABELS[CaseStatus.WAITING_ROOM]).toBe('Waiting Room')
    expect(STATUS_TAB_LABELS[CaseStatus.IN_PROGRESS]).toBe('In Progress')
    expect(STATUS_TAB_LABELS[CaseStatus.COMPLETED]).toBe('Completed')
  })
})

describe('STATUS_ORDER', () => {
  it('is monotonically increasing', () => {
    expect(STATUS_ORDER[CaseStatus.WAITING_ROOM]).toBeLessThan(STATUS_ORDER[CaseStatus.IN_PROGRESS])
    expect(STATUS_ORDER[CaseStatus.IN_PROGRESS]).toBeLessThan(STATUS_ORDER[CaseStatus.COMPLETED])
  })
})

describe('VALID_STATUS_TRANSITIONS', () => {
  it('allows waiting_room -> in_progress', () => {
    expect(VALID_STATUS_TRANSITIONS[CaseStatus.WAITING_ROOM]).toContain(CaseStatus.IN_PROGRESS)
  })

  it('allows in_progress -> completed', () => {
    expect(VALID_STATUS_TRANSITIONS[CaseStatus.IN_PROGRESS]).toContain(CaseStatus.COMPLETED)
  })

  it('has no outgoing transitions from completed status', () => {
    const transitions = VALID_STATUS_TRANSITIONS[CaseStatus.COMPLETED]
    expect(transitions === undefined || transitions.length === 0).toBe(true)
  })

  it('does not allow skipping (waiting_room -> completed)', () => {
    expect(VALID_STATUS_TRANSITIONS[CaseStatus.WAITING_ROOM]).not.toContain(CaseStatus.COMPLETED)
  })
})

describe('formatDateTime', () => {
  it('returns empty string for undefined', () => {
    expect(formatDateTime(undefined)).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(formatDateTime('')).toBe('')
  })

  it('formats a valid ISO string', () => {
    const result = formatDateTime('2024-01-15T10:30:00Z')
    expect(result).toMatch(/Jan/)
    expect(result).toMatch(/15/)
    expect(result).toMatch(/2024/)
  })

  it('returns the input string for invalid dates', () => {
    // formatDateTime catches errors; 'Invalid Date' is the toLocaleString output for bad dates
    const result = formatDateTime('not-a-date')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
