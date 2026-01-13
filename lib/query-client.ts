// TanStack Query Client Configuration
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // Consider data fresh for 30 seconds
      gcTime: 5 * 60 * 1000, // Keep unused data in cache for 5 minutes
      refetchOnWindowFocus: true, // Refetch when user returns to window
      retry: 1, // Retry failed requests once
    },
    mutations: {
      retry: 1,
    },
  },
});
