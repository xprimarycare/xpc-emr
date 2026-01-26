'use client';

import React, { useState } from 'react';
import { Zap, X } from 'lucide-react';
import { useSidebar } from '@/lib/context/SidebarContext';
import { Order, OrderType } from '@/lib/types/order';

const orderTypeConfigs = [
  { type: 'lab' as OrderType, keywords: ['order', 'lab', 'labs', 'blood', 'test', 'cbc', 'cmp'] },
  { type: 'referral' as OrderType, keywords: ['refer', 'referral', 'consult'] },
  { type: 'rx' as OrderType, keywords: ['rx', 'med', 'prescription', 'prescribe', 'metformin'] },
  { type: 'schedule' as OrderType, keywords: ['schedule', 'appointment', 'followup', 'follow-up'] }
];

const exampleCommands = [
  'order CBC, CMP, lipid panel',
  'refer to cardiology',
  'rx metformin 500mg bid',
  'schedule follow-up 2 weeks'
];

export function OrdersPanel() {
  const { orders, addOrder, removeOrder } = useSidebar();
  const [input, setInput] = useState('');

  const handleSubmit = () => {
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Command Input */}
      <div className="p-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command... (e.g., order labs, refer to cardiology)"
          rows={4}
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-blue-400 focus:bg-white"
        />
      </div>

      {/* Pending Actions */}
      <div className="flex-1 overflow-y-auto px-4">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center pt-8">
            <Zap size={32} className="text-gray-300 mb-4" />
            <p className="text-gray-400 text-sm mb-2">No pending actions</p>
            <p className="text-gray-400 text-xs mb-4">Type commands to place orders:</p>
            <ul className="space-y-2">
              {exampleCommands.map((cmd, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400">•</span>
                  <code className="px-2 py-1 bg-gray-100 rounded text-gray-600 font-mono text-xs">
                    {cmd}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-3">Pending actions ({orders.length})</p>
            {orders.map(order => (
              <div
                key={order.id}
                className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg group"
              >
                <Zap size={16} className="text-blue-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{order.text}</p>
                  <p className="text-xs text-gray-500 mt-1 uppercase">
                    {order.type}
                  </p>
                </div>
                <button
                  onClick={() => removeOrder(order.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-100 rounded transition-opacity"
                >
                  <X size={14} className="text-gray-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
