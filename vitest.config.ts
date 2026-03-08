import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    include: ['__tests__/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'lib/utils.ts',
        'lib/rate-limit.ts',
        'lib/auth-helpers.ts',
        'lib/constants/case-status.ts',
        'lib/context/PatientContext.tsx',
        'lib/context/EditorContext.tsx',
        'lib/context/SidebarContext.tsx',
        'app/**/actions.ts',
        'app/api/user/**/route.ts',
        'app/api/admin/**/route.ts',
        'app/api/patient-tags/route.ts',
        'app/api/case-library/route.ts',
        'app/**/LoginForm.tsx',
        'app/**/RegisterForm.tsx',
        'app/**/OnboardingForm.tsx',
        'app/**/ProfileForm.tsx',
        'app/**/UserManagement.tsx',
      ],
      exclude: [
        'app/generated/**',
      ],
      thresholds: {
        statements: 80,
        branches: 65,
        functions: 75,
        lines: 80,
      },
    },
  },
})
