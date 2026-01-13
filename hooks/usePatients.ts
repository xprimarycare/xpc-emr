// TanStack Query Hooks for Patient Operations
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/data/repositories';
import type { Patient } from '@/lib/types';

const repo = getRepository();

// Query keys
const patientKeys = {
  all: ['patients'] as const,
  detail: (id: string) => ['patients', id] as const,
  summary: (id: string) => ['patients', id, 'summary'] as const,
};

// Get all patients
export function usePatients() {
  return useQuery({
    queryKey: patientKeys.all,
    queryFn: () => repo.getPatients(),
  });
}

// Get single patient
export function usePatient(patientId: string | null) {
  return useQuery({
    queryKey: patientId ? patientKeys.detail(patientId) : ['patients', 'null'],
    queryFn: () => patientId ? repo.getPatient(patientId) : null,
    enabled: !!patientId,
  });
}

// Get patient summary
export function usePatientSummary(patientId: string | null) {
  return useQuery({
    queryKey: patientId ? patientKeys.summary(patientId) : ['patients', 'null', 'summary'],
    queryFn: () => patientId ? repo.getSummary(patientId) : '',
    enabled: !!patientId,
  });
}

// Save/update patient
export function useSavePatient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (patient: Patient) => repo.savePatient(patient),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: patientKeys.all });
    },
  });
}

// Save patient summary
export function useSaveSummary() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ patientId, summary }: { patientId: string; summary: string }) =>
      repo.saveSummary(patientId, summary),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: patientKeys.summary(variables.patientId) });
    },
  });
}

// Delete patient
export function useDeletePatient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (patientId: string) => repo.deletePatient(patientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: patientKeys.all });
    },
  });
}
