'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Variable, Template } from '../types/variable';
import { Order } from '../types/order';
import { ChartReviewRequest } from '../types/chart-review';
import { mockVariables, mockTemplates } from '../data/mock-variables';
import { usePatient } from './PatientContext';

type RightPanelType = 'orders' | 'variables' | 'templates' | 'ai' | 'chartReview' | 'calendar' | 'chat' | null;

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
  addVariable: (name: string, content: string, isPinned?: boolean) => void;
  updateVariable: (name: string, content: string) => void;
  deleteVariable: (name: string) => void;
  toggleVariablePin: (name: string) => void;
  chartReviewContent: ChartReviewRequest | null;
  setChartReviewContent: (content: ChartReviewRequest | null) => void;
  addTemplate: (name: string, content: string) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [rightPanelType, setRightPanelTypeState] = useState<RightPanelType>('orders');
  const [variables, setVariables] = useState<Record<string, Variable>>(mockVariables);
  const [templates, setTemplates] = useState<Record<string, Template>>(mockTemplates);
  const { activePatientId } = usePatient();
  const [ordersByPatient, setOrdersByPatient] = useState<Record<string, Order[]>>({});
  const [chartReviewContent, setChartReviewContent] = useState<ChartReviewRequest | null>(null);
  const orders = activePatientId ? (ordersByPatient[activePatientId] ?? []) : [];

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
      if (!rightPanelOpen) {
        setRightPanelTypeState(rightPanelType || 'orders');
      }
      setRightPanelOpen(!rightPanelOpen);
    }
  };

  const addOrder = (order: Order) => {
    if (!activePatientId) return;
    setOrdersByPatient(prev => ({
      ...prev,
      [activePatientId]: [...(prev[activePatientId] ?? []), order],
    }));
  };

  const removeOrder = (id: string) => {
    if (!activePatientId) return;
    setOrdersByPatient(prev => ({
      ...prev,
      [activePatientId]: (prev[activePatientId] ?? []).filter(o => o.id !== id),
    }));
  };

  const addVariable = (name: string, content: string, isPinned: boolean = false) => {
    setVariables(prev => ({
      ...prev,
      [name]: {
        name,
        content,
        isPinned
      }
    }));
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

  const deleteVariable = (name: string) => {
    setVariables(prev => {
      const updated = { ...prev };
      delete updated[name];
      return updated;
    });
  };

  const toggleVariablePin = (name: string) => {
    setVariables(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        isPinned: !prev[name]?.isPinned
      }
    }));
  };

  const addTemplate = (name: string, content: string) => {
    const key = name.toLowerCase().replace(/\s+/g, '_');
    setTemplates(prev => ({
      ...prev,
      [key]: { name: key, content, isPinned: false }
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
        addVariable,
        updateVariable,
        deleteVariable,
        toggleVariablePin,
        chartReviewContent,
        setChartReviewContent,
        addTemplate
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
