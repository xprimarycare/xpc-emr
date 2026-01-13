// TanStack Query Hooks for Templates Operations
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/data/repositories';
import type { Templates } from '@/lib/types';

const repo = getRepository();

// Query keys
const templateKeys = {
  all: ['templates'] as const,
};

// Get all templates
export function useTemplates() {
  return useQuery({
    queryKey: templateKeys.all,
    queryFn: () => repo.getTemplates(),
  });
}

// Save templates
export function useSaveTemplates() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (templates: Templates) => repo.saveTemplates(templates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}
