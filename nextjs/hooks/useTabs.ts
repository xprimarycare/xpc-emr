// TanStack Query Hooks for Tab/Document Operations
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/data/repositories';
import type { Tab } from '@/lib/types';

const repo = getRepository();

// Query keys
const tabKeys = {
  byPatient: (patientId: string) => ['tabs', patientId] as const,
};

// Get tabs for a patient
export function useTabs(patientId: string | null) {
  return useQuery({
    queryKey: patientId ? tabKeys.byPatient(patientId) : ['tabs', 'null'],
    queryFn: () => patientId ? repo.getTabs(patientId) : [],
    enabled: !!patientId,
  });
}

// Save all tabs for a patient
export function useSaveTabs() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ patientId, tabs }: { patientId: string; tabs: Tab[] }) =>
      repo.saveTabs(patientId, tabs),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: tabKeys.byPatient(variables.patientId) });
    },
  });
}

// Save single tab
export function useSaveTab() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ patientId, tab }: { patientId: string; tab: Tab }) =>
      repo.saveTab(patientId, tab),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: tabKeys.byPatient(variables.patientId) });
    },
  });
}

// Delete tab
export function useDeleteTab() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ patientId, tabId }: { patientId: string; tabId: string }) =>
      repo.deleteTab(patientId, tabId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: tabKeys.byPatient(variables.patientId) });
    },
  });
}
