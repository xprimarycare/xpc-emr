import { render, RenderOptions } from '@testing-library/react'
import { ReactElement, ReactNode } from 'react'
import { PatientProvider } from '@/lib/context/PatientContext'
import { EditorProvider } from '@/lib/context/EditorContext'

function AllProviders({ children }: { children: ReactNode }) {
  return (
    <PatientProvider>
      <EditorProvider>
        {children}
      </EditorProvider>
    </PatientProvider>
  )
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options })
}

export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
