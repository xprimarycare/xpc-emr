export const UserRole = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

export type UserRoleValue = (typeof UserRole)[keyof typeof UserRole];

export const CaseStatus = {
  WAITING_ROOM: 'waiting_room',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} as const;

export type CaseStatusValue = (typeof CaseStatus)[keyof typeof CaseStatus];

export const STATUS_BADGE: Record<CaseStatusValue, { bg: string; text: string; label: string }> = {
  [CaseStatus.WAITING_ROOM]: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Waiting Room' },
  [CaseStatus.IN_PROGRESS]: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Progress' },
  [CaseStatus.COMPLETED]: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
};

export const STATUS_TAB_LABELS: Record<CaseStatusValue, string> = {
  [CaseStatus.WAITING_ROOM]: 'Waiting Room',
  [CaseStatus.IN_PROGRESS]: 'In Progress',
  [CaseStatus.COMPLETED]: 'Completed',
};

export const STATUS_ORDER: Record<string, number> = {
  [CaseStatus.WAITING_ROOM]: 0,
  [CaseStatus.IN_PROGRESS]: 1,
  [CaseStatus.COMPLETED]: 2,
};

export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  [CaseStatus.WAITING_ROOM]: [CaseStatus.IN_PROGRESS],
  [CaseStatus.IN_PROGRESS]: [CaseStatus.COMPLETED],
};

export function formatDateTime(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
    });
  } catch {
    return iso;
  }
}
