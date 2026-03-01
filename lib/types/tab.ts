export type TabSection = 'pages' | 'encounters' | 'tasks';

export interface SidebarSection {
  id: TabSection;
  title: string;
  collapsed: boolean;
}

export interface TabItemData {
  id: string;
  name: string;
  section: TabSection;
  starred?: boolean;
  isVisit?: boolean;
  isTask?: boolean;
  visitDate?: string;
  parentId?: string;
  isSubtab?: boolean;
  order?: number;
}
