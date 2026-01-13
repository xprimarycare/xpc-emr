// TanStack Query Hooks for Variables Operations
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/data/repositories';
import type { Variables } from '@/lib/types';

const repo = getRepository();

// Query keys
const variableKeys = {
  byPatient: (patientId: string) => ['variables', patientId] as const,
};

// Get variables for a patient
export function useVariables(patientId: string | null) {
  return useQuery({
    queryKey: patientId ? variableKeys.byPatient(patientId) : ['variables', 'null'],
    queryFn: () => patientId ? repo.getVariables(patientId) : {},
    enabled: !!patientId,
  });
}

// Save variables
export function useSaveVariables() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ patientId, variables }: { patientId: string; variables: Variables }) =>
      repo.saveVariables(patientId, variables),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: variableKeys.byPatient(vars.patientId) });
    },
  });
}
