'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Variable, Template } from '../types/variable';
import { Order } from '../types/order';
import { mockVariables, mockTemplates } from '../data/mock-variables';

type RightPanelType = 'orders' | 'variables' | 'templates' | null;

interface SidebarContextType {
  rightPanelOpen: boolean;
  rightPanelType: RightPanelType;
  setRightPanelType: (type: RightPanelType) => void;
  toggleRightPanel: (type?: RightPanelType) => void;
  variables: Record<string, Variable>;
  templates: Record<string, Template>;
  orders: Order[];
  addOrder: (order: Order) => void;
  removeOrder: (id: string) => void;
  updateVariable: (name: string, content: string) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [rightPanelType, setRightPanelTypeState] = useState<RightPanelType>(null);
  const [variables, setVariables] = useState<Record<string, Variable>>(mockVariables);
  const [templates] = useState<Record<string, Template>>(mockTemplates);
  const [orders, setOrders] = useState<Order[]>([]);

  const setRightPanelType = (type: RightPanelType) => {
    setRightPanelTypeState(type);
    if (type) {
      setRightPanelOpen(true);
    }
  };

  const toggleRightPanel = (type?: RightPanelType) => {
    if (type) {
      if (rightPanelType === type && rightPanelOpen) {
        setRightPanelOpen(false);
      } else {
        setRightPanelTypeState(type);
        setRightPanelOpen(true);
      }
    } else {
      setRightPanelOpen(!rightPanelOpen);
    }
  };

  const addOrder = (order: Order) => {
    setOrders(prev => [...prev, order]);
  };

  const removeOrder = (id: string) => {
    setOrders(prev => prev.filter(o => o.id !== id));
  };

  const updateVariable = (name: string, content: string) => {
    setVariables(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        content
      }
    }));
  };

  return (
    <SidebarContext.Provider
      value={{
        rightPanelOpen,
        rightPanelType,
        setRightPanelType,
        toggleRightPanel,
        variables,
        templates,
        orders,
        addOrder,
        removeOrder,
        updateVariable
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
}
