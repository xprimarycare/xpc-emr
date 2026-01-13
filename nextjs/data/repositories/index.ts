// Active Repository Export
// Change this import to swap data storage implementations
import { LocalStorageRepository } from './local-storage';
import type { IEMRRepository } from './types';

// Singleton instance
let repositoryInstance: IEMRRepository | null = null;

export function getRepository(): IEMRRepository {
  if (!repositoryInstance) {
    repositoryInstance = new LocalStorageRepository();
    
    // Future: Switch to API implementation
    // repositoryInstance = new APIRepository();
  }
  
  return repositoryInstance;
}

// Export types for convenience
export type { IEMRRepository } from './types';
