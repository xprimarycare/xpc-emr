import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { PatientProvider, usePatient } from '@/lib/context/PatientContext'
import { ReactNode } from 'react'

const wrapper = ({ children }: { children: ReactNode }) => (
  <PatientProvider>{children}</PatientProvider>
)

const makePatient = (id: string, tabs: any[] = []) => ({
  id,
  name: `Patient ${id}`,
  dob: '1990-01-01',
  sex: 'Male' as const,
  mrn: `MRN-${id}`,
  tabs,
})

const makeTab = (id: string, section = 'pages' as any) => ({
  id,
  name: `Tab ${id}`,
  content: '',
  section,
  starred: false,
  isSubtab: false,
  parentId: undefined,
})

describe('PatientContext', () => {
  it('starts with empty patients and null activePatientId', () => {
    const { result } = renderHook(() => usePatient(), { wrapper })
    expect(result.current.patients).toEqual([])
    expect(result.current.activePatientId).toBeNull()
    expect(result.current.activePatient).toBeNull()
  })

  it('addPatient adds and sets as active', () => {
    const { result } = renderHook(() => usePatient(), { wrapper })
    act(() => result.current.addPatient(makePatient('p1')))
    expect(result.current.patients).toHaveLength(1)
    expect(result.current.activePatientId).toBe('p1')
    expect(result.current.activePatient?.name).toBe('Patient p1')
  })

  it('removePatient removes and switches active to first remaining', () => {
    const { result } = renderHook(() => usePatient(), { wrapper })
    act(() => {
      result.current.addPatient(makePatient('p1'))
      result.current.addPatient(makePatient('p2'))
    })
    expect(result.current.activePatientId).toBe('p2')

    act(() => result.current.removePatient('p2'))
    expect(result.current.patients).toHaveLength(1)
    expect(result.current.activePatientId).toBe('p1')
  })

  it('removePatient on last patient sets null', () => {
    const { result } = renderHook(() => usePatient(), { wrapper })
    act(() => result.current.addPatient(makePatient('p1')))
    act(() => result.current.removePatient('p1'))
    expect(result.current.patients).toHaveLength(0)
    expect(result.current.activePatientId).toBeNull()
  })

  it('updatePatient merges updates', () => {
    const { result } = renderHook(() => usePatient(), { wrapper })
    act(() => result.current.addPatient(makePatient('p1')))
    act(() => result.current.updatePatient('p1', { name: 'Updated Name' }))
    expect(result.current.patients[0].name).toBe('Updated Name')
  })

  it('setActivePatientId changes active', () => {
    const { result } = renderHook(() => usePatient(), { wrapper })
    act(() => {
      result.current.addPatient(makePatient('p1'))
      result.current.addPatient(makePatient('p2'))
    })
    act(() => result.current.setActivePatientId('p1'))
    expect(result.current.activePatientId).toBe('p1')
  })

  it('addTabToPatient appends tab', () => {
    const { result } = renderHook(() => usePatient(), { wrapper })
    act(() => result.current.addPatient(makePatient('p1', [makeTab('t1')])))
    act(() => result.current.addTabToPatient('p1', makeTab('t2')))
    expect(result.current.patients[0].tabs).toHaveLength(2)
  })

  it('renameTab changes tab name', () => {
    const { result } = renderHook(() => usePatient(), { wrapper })
    act(() => result.current.addPatient(makePatient('p1', [makeTab('t1')])))
    act(() => result.current.renameTab('p1', 't1', 'New Name'))
    expect(result.current.patients[0].tabs[0].name).toBe('New Name')
  })

  it('toggleTabStar toggles starred', () => {
    const { result } = renderHook(() => usePatient(), { wrapper })
    act(() => result.current.addPatient(makePatient('p1', [makeTab('t1')])))
    expect(result.current.patients[0].tabs[0].starred).toBe(false)
    act(() => result.current.toggleTabStar('p1', 't1'))
    expect(result.current.patients[0].tabs[0].starred).toBe(true)
    act(() => result.current.toggleTabStar('p1', 't1'))
    expect(result.current.patients[0].tabs[0].starred).toBe(false)
  })

  it('deleteTab removes tab', () => {
    const { result } = renderHook(() => usePatient(), { wrapper })
    act(() => result.current.addPatient(makePatient('p1', [makeTab('t1'), makeTab('t2')])))
    act(() => result.current.deleteTab('p1', 't1'))
    expect(result.current.patients[0].tabs).toHaveLength(1)
    expect(result.current.patients[0].tabs[0].id).toBe('t2')
  })

  it('duplicateTab creates copy with " (Copy)" suffix', () => {
    const { result } = renderHook(() => usePatient(), { wrapper })
    act(() => result.current.addPatient(makePatient('p1', [makeTab('t1')])))
    act(() => result.current.duplicateTab('p1', 't1'))
    expect(result.current.patients[0].tabs).toHaveLength(2)
    expect(result.current.patients[0].tabs[1].name).toBe('Tab t1 (Copy)')
    expect(result.current.patients[0].tabs[1].id).not.toBe('t1')
  })

  it('updateTabProperties merges into tab', () => {
    const { result } = renderHook(() => usePatient(), { wrapper })
    act(() => result.current.addPatient(makePatient('p1', [makeTab('t1')])))
    act(() => result.current.updateTabProperties('p1', 't1', { starred: true }))
    expect(result.current.patients[0].tabs[0].starred).toBe(true)
  })

  it('reorderTabs before position', () => {
    const { result } = renderHook(() => usePatient(), { wrapper })
    act(() => result.current.addPatient(makePatient('p1', [makeTab('t1'), makeTab('t2'), makeTab('t3')])))
    act(() => result.current.reorderTabs('p1', 't3', 't1', 'before'))
    const ids = result.current.patients[0].tabs.map(t => t.id)
    expect(ids.indexOf('t3')).toBeLessThan(ids.indexOf('t1'))
  })

  it('reorderTabs after position', () => {
    const { result } = renderHook(() => usePatient(), { wrapper })
    act(() => result.current.addPatient(makePatient('p1', [makeTab('t1'), makeTab('t2'), makeTab('t3')])))
    act(() => result.current.reorderTabs('p1', 't1', 't3', 'after'))
    const ids = result.current.patients[0].tabs.map(t => t.id)
    expect(ids.indexOf('t1')).toBeGreaterThan(ids.indexOf('t3'))
  })

  it('reorderTabs child position sets parentId', () => {
    const { result } = renderHook(() => usePatient(), { wrapper })
    act(() => result.current.addPatient(makePatient('p1', [makeTab('t1'), makeTab('t2')])))
    act(() => result.current.reorderTabs('p1', 't2', 't1', 'child'))
    const t2 = result.current.patients[0].tabs.find(t => t.id === 't2')!
    expect(t2.parentId).toBe('t1')
    expect(t2.isSubtab).toBe(true)
  })

  it('usePatient outside provider throws error', () => {
    expect(() => {
      renderHook(() => usePatient())
    }).toThrow('usePatient must be used within PatientProvider')
  })
})
