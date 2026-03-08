import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { EditorProvider, useEditor } from '@/lib/context/EditorContext'
import { ReactNode } from 'react'

const wrapper = ({ children }: { children: ReactNode }) => (
  <EditorProvider>{children}</EditorProvider>
)

describe('EditorContext', () => {
  it('starts with correct defaults', () => {
    const { result } = renderHook(() => useEditor(), { wrapper })
    expect(result.current.activeTabId).toBeNull()
    expect(result.current.searchQuery).toBe('')
    expect(result.current.leftPanelMode).toBe('sidebar')
    expect(result.current.leftSidebarCollapsed).toBe(false)
    expect(result.current.collapsedSections).toEqual({
      pages: false,
      encounters: false,
      tasks: false,
    })
  })

  it('setActiveTabId updates active tab', () => {
    const { result } = renderHook(() => useEditor(), { wrapper })
    act(() => result.current.setActiveTabId('tab-1'))
    expect(result.current.activeTabId).toBe('tab-1')
  })

  it('toggleSection toggles collapsed state', () => {
    const { result } = renderHook(() => useEditor(), { wrapper })
    expect(result.current.collapsedSections.pages).toBe(false)
    act(() => result.current.toggleSection('pages'))
    expect(result.current.collapsedSections.pages).toBe(true)
    act(() => result.current.toggleSection('pages'))
    expect(result.current.collapsedSections.pages).toBe(false)
  })

  it('setSearchQuery updates search query', () => {
    const { result } = renderHook(() => useEditor(), { wrapper })
    act(() => result.current.setSearchQuery('test query'))
    expect(result.current.searchQuery).toBe('test query')
  })

  it('updateTabContent stores content by tabId', () => {
    const { result } = renderHook(() => useEditor(), { wrapper })
    act(() => result.current.updateTabContent('tab-1', 'Hello world'))
    expect(result.current.tabContent['tab-1']).toBe('Hello world')
  })

  it('updateTabContent preserves other tabs content', () => {
    const { result } = renderHook(() => useEditor(), { wrapper })
    act(() => {
      result.current.updateTabContent('tab-1', 'Content 1')
      result.current.updateTabContent('tab-2', 'Content 2')
    })
    expect(result.current.tabContent['tab-1']).toBe('Content 1')
    expect(result.current.tabContent['tab-2']).toBe('Content 2')
  })

  it('toggleLeftPanel toggles panel mode', () => {
    const { result } = renderHook(() => useEditor(), { wrapper })
    act(() => result.current.toggleLeftPanel('patientList'))
    expect(result.current.leftPanelMode).toBe('patientList')
    expect(result.current.leftSidebarCollapsed).toBe(true)
  })

  it('toggleLeftPanel collapses when clicking same type', () => {
    const { result } = renderHook(() => useEditor(), { wrapper })
    act(() => result.current.toggleLeftPanel('patientList'))
    act(() => result.current.toggleLeftPanel('patientList'))
    expect(result.current.leftPanelMode).toBeNull()
  })

  it('toggleLeftPanel switches between types', () => {
    const { result } = renderHook(() => useEditor(), { wrapper })
    act(() => result.current.toggleLeftPanel('patientList'))
    act(() => result.current.toggleLeftPanel('caseLibrary'))
    expect(result.current.leftPanelMode).toBe('caseLibrary')
  })

  it('responds to custom setActiveTab event', () => {
    const { result } = renderHook(() => useEditor(), { wrapper })
    act(() => {
      window.dispatchEvent(new CustomEvent('setActiveTab', { detail: 'event-tab' }))
    })
    expect(result.current.activeTabId).toBe('event-tab')
  })

  it('useEditor outside provider throws error', () => {
    expect(() => {
      renderHook(() => useEditor())
    }).toThrow('useEditor must be used within EditorProvider')
  })
})
