import { PatientData } from '../types/patient';

export const mockPatients: PatientData[] = [];

export const getPatientById = (id: string): PatientData | undefined => {
  return mockPatients.find(p => p.id === id);
};
