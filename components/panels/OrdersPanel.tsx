'use client';

import React, { useState } from 'react';
import { FlaskConical, UserPlus, Pill, Calendar, X } from 'lucide-react';
import { useSidebar } from '@/lib/context/SidebarContext';
import { Order, OrderType } from '@/lib/types/order';

const orderTypeConfigs = [
  { type: 'lab' as OrderType, keywords: ['lab', 'labs', 'blood', 'test'], icon: 'flask', placeholder: 'Order labs (e.g., CBC, CMP)' },
  { type: 'referral' as OrderType, keywords: ['refer', 'referral', 'consult'], icon: 'user-plus', placeholder: 'Referral to specialist' },
  { type: 'rx' as OrderType, keywords: ['rx', 'med', 'prescription', 'prescribe'], icon: 'pill', placeholder: 'Prescribe medication' },
  { type: 'schedule' as OrderType, keywords: ['schedule', 'appointment', 'followup'], icon: 'calendar', placeholder: 'Schedule appointment' }
];

const getIcon = (type: OrderType) => {
  switch (type) {
    case 'lab': return <FlaskConical size={16} />;
    case 'referral': return <UserPlus size={16} />;
    case 'rx': return <Pill size={16} />;
    case 'schedule': return <Calendar size={16} />;
    default: return null;
  }
};

export function OrdersPanel() {
  const { orders, addOrder, removeOrder } = useSidebar();
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    let orderType: OrderType = 'lab';
    const lowerInput = input.toLowerCase();

    for (const config of orderTypeConfigs) {
      if (config.keywords.some(keyword => lowerInput.includes(keyword))) {
        orderType = config.type;
        break;
      }
    }

    const newOrder: Order = {
      id: `order-${Date.now()}`,
      type: orderType,
      text: input.trim(),
      timestamp: new Date().toISOString()
    };

    addOrder(newOrder);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm mb-3">Orders</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type order command..."
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {orders.length === 0 ? (
          <p className="text-sm text-gray-500">No orders yet</p>
        ) : (
          orders.map(order => (
            <div
              key={order.id}
              className="flex items-start gap-2 p-2 bg-gray-50 rounded-md group"
            >
              <div className="mt-0.5">{getIcon(order.type)}</div>
              <div className="flex-1">
                <p className="text-sm">{order.text}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {order.type.toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => removeOrder(order.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded"
              >
                <X size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
