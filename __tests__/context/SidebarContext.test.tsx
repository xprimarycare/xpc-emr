import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { SidebarProvider, useSidebar } from '@/lib/context/SidebarContext'
import { PatientProvider, usePatient } from '@/lib/context/PatientContext'
import { ReactNode } from 'react'

vi.mock('@/lib/variable-formatters', () => ({
  buildPatientVariables: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/lib/data/mock-variables', () => ({
  mockVariables: { demo: { name: 'demo', content: 'Demo content', isPinned: false } },
  mockTemplates: { template1: { name: 'template1', content: 'Template content', isPinned: false } },
}))

const wrapper = ({ children }: { children: ReactNode }) => (
  <PatientProvider>
    <SidebarProvider>{children}</SidebarProvider>
  </PatientProvider>
)

// Helper hook to access both contexts
function useBothContexts() {
  const patient = usePatient()
  const sidebar = useSidebar()
  return { patient, sidebar }
}

describe('SidebarContext', () => {
  it('starts with correct defaults', () => {
    const { result } = renderHook(() => useSidebar(), { wrapper })
    expect(result.current.rightPanelOpen).toBe(false)
    expect(result.current.rightPanelType).toBe('orders')
    expect(result.current.variablesLoading).toBe(false)
    expect(result.current.orders).toEqual([])
  })

  it('setRightPanelType opens panel', () => {
    const { result } = renderHook(() => useSidebar(), { wrapper })
    act(() => result.current.setRightPanelType('variables'))
    expect(result.current.rightPanelType).toBe('variables')
    expect(result.current.rightPanelOpen).toBe(true)
  })

  it('toggleRightPanel opens and closes', () => {
    const { result } = renderHook(() => useSidebar(), { wrapper })
    act(() => result.current.toggleRightPanel('orders'))
    expect(result.current.rightPanelOpen).toBe(true)

    act(() => result.current.toggleRightPanel('orders'))
    expect(result.current.rightPanelOpen).toBe(false)
  })

  it('toggleRightPanel switches type', () => {
    const { result } = renderHook(() => useSidebar(), { wrapper })
    act(() => result.current.toggleRightPanel('orders'))
    act(() => result.current.toggleRightPanel('variables'))
    expect(result.current.rightPanelType).toBe('variables')
    expect(result.current.rightPanelOpen).toBe(true)
  })

  it('toggleRightPanel without type toggles open/close', () => {
    const { result } = renderHook(() => useSidebar(), { wrapper })
    act(() => result.current.toggleRightPanel())
    expect(result.current.rightPanelOpen).toBe(true)

    act(() => result.current.toggleRightPanel())
    expect(result.current.rightPanelOpen).toBe(false)
  })

  it('addOrder and removeOrder with active patient', () => {
    const { result } = renderHook(() => useBothContexts(), { wrapper })

    act(() => {
      result.current.patient.addPatient({
        id: 'p1', name: 'Test', dob: '', sex: 'Male', mrn: '', tabs: [],
      })
    })

    act(() => {
      result.current.sidebar.addOrder({ id: 'o1', type: 'lab', name: 'CBC', status: 'pending' })
    })
    expect(result.current.sidebar.orders).toHaveLength(1)

    act(() => result.current.sidebar.removeOrder('o1'))
    expect(result.current.sidebar.orders).toHaveLength(0)
  })

  it('addOrder does nothing without active patient', () => {
    const { result } = renderHook(() => useSidebar(), { wrapper })
    act(() => result.current.addOrder({ id: 'o1', type: 'lab', name: 'CBC', status: 'pending' }))
    expect(result.current.orders).toEqual([])
  })

  it('addVariable and deleteVariable with active patient', () => {
    const { result } = renderHook(() => useBothContexts(), { wrapper })

    act(() => {
      result.current.patient.addPatient({
        id: 'p1', name: 'Test', dob: '', sex: 'Male', mrn: '', tabs: [],
      })
    })

    act(() => result.current.sidebar.addVariable('myVar', 'some content', true))
    expect(result.current.sidebar.variables.myVar).toBeDefined()
    expect(result.current.sidebar.variables.myVar.content).toBe('some content')
    expect(result.current.sidebar.variables.myVar.isPinned).toBe(true)

    act(() => result.current.sidebar.deleteVariable('myVar'))
    expect(result.current.sidebar.variables.myVar).toBeUndefined()
  })

  it('updateVariable changes content', () => {
    const { result } = renderHook(() => useBothContexts(), { wrapper })

    act(() => {
      result.current.patient.addPatient({
        id: 'p1', name: 'Test', dob: '', sex: 'Male', mrn: '', tabs: [],
      })
    })

    act(() => result.current.sidebar.addVariable('myVar', 'old content'))
    act(() => result.current.sidebar.updateVariable('myVar', 'new content'))
    expect(result.current.sidebar.variables.myVar.content).toBe('new content')
  })

  it('toggleVariablePin toggles isPinned', () => {
    const { result } = renderHook(() => useBothContexts(), { wrapper })

    act(() => {
      result.current.patient.addPatient({
        id: 'p1', name: 'Test', dob: '', sex: 'Male', mrn: '', tabs: [],
      })
    })

    act(() => result.current.sidebar.addVariable('myVar', 'content', false))
    act(() => result.current.sidebar.toggleVariablePin('myVar'))
    expect(result.current.sidebar.variables.myVar.isPinned).toBe(true)
  })

  it('addTemplate creates with sanitized key', () => {
    const { result } = renderHook(() => useSidebar(), { wrapper })
    act(() => result.current.addTemplate('My Template Name', 'Template content'))
    expect(result.current.templates).toHaveProperty('my_template_name')
    expect(result.current.templates.my_template_name.content).toBe('Template content')
  })

  it('useSidebar outside provider throws error', () => {
    expect(() => {
      renderHook(() => useSidebar())
    }).toThrow('useSidebar must be used within SidebarProvider')
  })
})
