export type OrderType = 'lab' | 'referral' | 'rx' | 'schedule' | 'imaging' | 'procedure';

export interface Order {
  id: string;
  type: OrderType;
  text: string;
  icon?: string;
  timestamp?: string;
}

export interface OrderTypeConfig {
  type: OrderType;
  keywords: string[];
  icon: string;
  placeholder: string;
}
