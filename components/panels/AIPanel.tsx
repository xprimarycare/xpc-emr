'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lightbulb, Send } from 'lucide-react';
import type { AIMessage } from '@/lib/types';

export function AIPanel() {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: AIMessage = {
      id: `msg-${Date.now()}`,
      type: 'query',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    // Mock AI response
    const aiResponse: AIMessage = {
      id: `msg-${Date.now() + 1}`,
      type: 'response',
      content: `This is a simulated AI response to: "${input.trim()}". In a production system, this would be powered by an actual AI service.`,
      timestamp: new Date().toISOString(),
    };

    setMessages([...messages, userMessage, aiResponse]);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const suggestions = [
    'What medications is this patient on?',
    'Summarize recent visits',
    'What are the care gaps?',
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <ScrollArea className="flex-1 p-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-4">
              <Lightbulb className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              AI Assistant
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Ask questions about patient data
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestions.map((suggestion, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setInput(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex flex-col gap-1 ${
                  message.type === 'query' ? 'items-end' : 'items-start'
                }`}
              >
                {message.type === 'response' && (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-purple-600">
                    <Lightbulb className="h-3.5 w-3.5" />
                    AI Assistant
                  </div>
                )}
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-xl text-sm ${
                    message.type === 'query'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm'
                  }`}
                >
                  {message.content}
                </div>
                <span className="text-xs text-gray-400 px-1">
                  {formatTime(message.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-gray-200 bg-white">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about patient data..."
            rows={2}
            className="resize-none text-sm"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim()}
            size="icon"
            className="flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        )}
      </div>
    </div>
  );
}
