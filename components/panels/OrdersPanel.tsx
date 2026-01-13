'use client';

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FlaskConical, UserPlus, Pill, Calendar, Check, X } from 'lucide-react';
import type { Order, OrderType } from '@/lib/types';

export function OrdersPanel() {
  const [commandInput, setCommandInput] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);

  const detectOrderType = (text: string): OrderType => {
    const lower = text.toLowerCase();
    if (lower.includes('order') || lower.includes('lab') || lower.includes('cbc') || lower.includes('cmp')) {
      return 'labs';
    }
    if (lower.includes('refer') || lower.includes('consult')) {
      return 'referral';
    }
    if (lower.includes('rx') || lower.includes('prescribe') || lower.includes('medication')) {
      return 'rx';
    }
    if (lower.includes('schedule') || lower.includes('follow') || lower.includes('appointment')) {
      return 'schedule';
    }
    return 'other';
  };

  const getOrderIcon = (type: OrderType) => {
    switch (type) {
      case 'labs':
        return <FlaskConical className="h-4 w-4" />;
      case 'referral':
        return <UserPlus className="h-4 w-4" />;
      case 'rx':
        return <Pill className="h-4 w-4" />;
      case 'schedule':
        return <Calendar className="h-4 w-4" />;
      default:
        return <FlaskConical className="h-4 w-4" />;
    }
  };

  const getOrderColor = (type: OrderType) => {
    switch (type) {
      case 'labs':
        return 'bg-blue-100 text-blue-700';
      case 'referral':
        return 'bg-yellow-100 text-yellow-700';
      case 'rx':
        return 'bg-green-100 text-green-700';
      case 'schedule':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddOrder();
    }
  };

  const handleAddOrder = () => {
    if (!commandInput.trim()) return;

    const newOrder: Order = {
      id: `order-${Date.now()}`,
      text: commandInput.trim(),
      type: detectOrderType(commandInput),
      createdAt: new Date().toISOString(),
    };

    setOrders([...orders, newOrder]);
    setCommandInput('');
  };

  const handleConfirmOrder = (orderId: string) => {
    setOrders(orders.filter((o) => o.id !== orderId));
    // TODO: Actually process the order
  };

  const handleCancelOrder = (orderId: string) => {
    setOrders(orders.filter((o) => o.id !== orderId));
  };

  return (
    <div className="flex flex-col h-full p-4">
      {/* Command Input */}
      <div className="mb-4">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 focus-within:border-blue-500 focus-within:bg-white transition-colors">
          <Textarea
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command... (e.g., order CBC, refer to cardiology)"
            className="border-0 bg-transparent p-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
            rows={4}
          />
        </div>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto">
        {orders.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium mb-1">No pending actions</p>
            <p className="text-xs">Type commands to place orders</p>
            <div className="mt-4 text-xs text-left space-y-2 px-4">
              <div className="text-gray-500">
                <code className="bg-gray-100 px-2 py-0.5 rounded">order CBC, CMP</code>
              </div>
              <div className="text-gray-500">
                <code className="bg-gray-100 px-2 py-0.5 rounded">refer to cardiology</code>
              </div>
              <div className="text-gray-500">
                <code className="bg-gray-100 px-2 py-0.5 rounded">rx metformin 500mg</code>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                <div className={`p-2 rounded-md ${getOrderColor(order.type)}`}>
                  {getOrderIcon(order.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{order.text}</p>
                  <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">
                    {order.type}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-green-100 hover:text-green-700"
                    onClick={() => handleConfirmOrder(order.id)}
                    title="Confirm"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-red-100 hover:text-red-700"
                    onClick={() => handleCancelOrder(order.id)}
                    title="Cancel"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
