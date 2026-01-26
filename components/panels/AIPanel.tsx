'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Lightbulb } from 'lucide-react';

interface AIMessage {
  type: 'query' | 'response';
  content: string;
  time: Date;
}

function getWelcomeMessage(): AIMessage {
  return {
    type: 'response',
    content: `<strong>Welcome!</strong> I can help you query information from this patient's record. Try asking about:
      <ul>
        <li>Current medications</li>
        <li>Recent visit summaries</li>
        <li>Care gaps and screenings due</li>
        <li>Lab results and trends</li>
      </ul>`,
    time: new Date()
  };
}

function simulateAiResponse(query: string): string {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('medication') || lowerQuery.includes('med') || lowerQuery.includes('drug')) {
    return `<strong>Current Medications:</strong>
      <ul>
        <li>Lisinopril 10mg - once daily (hypertension)</li>
        <li>Metformin 500mg - twice daily (diabetes)</li>
        <li>Melatonin 3mg - as needed (sleep)</li>
        <li>Atorvastatin 20mg - once daily (cholesterol)</li>
      </ul>
      <em>Last updated: Today's visit</em>`;
  } else if (lowerQuery.includes('visit') || lowerQuery.includes('encounter') || lowerQuery.includes('summary')) {
    return `<strong>Recent Visits:</strong>
      <ul>
        <li><strong>Jan 2, 2026</strong> - Follow-up visit for diabetes and hypertension. BP well controlled.</li>
        <li><strong>Nov 15, 2025</strong> - Annual wellness exam. Ordered routine labs.</li>
        <li><strong>Sep 8, 2025</strong> - Acute visit for upper respiratory symptoms.</li>
      </ul>`;
  } else if (lowerQuery.includes('care gap') || lowerQuery.includes('screening') || lowerQuery.includes('due')) {
    return `<strong>Care Gaps & Screenings Due:</strong>
      <ul>
        <li>Colonoscopy - overdue (last: never, recommended age 45+)</li>
        <li>A1C - due in 2 weeks (last: Nov 2025)</li>
        <li>Flu vaccine - completed Oct 2025</li>
        <li>Annual wellness exam - completed Nov 2025</li>
      </ul>`;
  } else if (lowerQuery.includes('lab') || lowerQuery.includes('result') || lowerQuery.includes('test')) {
    return `<strong>Recent Lab Results:</strong>
      <ul>
        <li><strong>A1C (Nov 2025):</strong> 6.8% (improved from 7.1%)</li>
        <li><strong>Lipid Panel (Nov 2025):</strong> Total cholesterol 185, LDL 98, HDL 52</li>
        <li><strong>Basic Metabolic (Nov 2025):</strong> All within normal limits</li>
        <li><strong>eGFR:</strong> 78 mL/min (stable)</li>
      </ul>`;
  } else if (lowerQuery.includes('allerg')) {
    return `<strong>Allergies:</strong>
      <ul>
        <li>Penicillin - causes rash</li>
        <li>Sulfa drugs - hives</li>
        <li>No known food allergies</li>
      </ul>`;
  }

  return `I found information related to your query in the patient record. Please try asking about medications, visit history, lab results, care gaps, or allergies for more specific details.`;
}

export function AIPanel() {
  const [messages, setMessages] = useState<AIMessage[]>([getWelcomeMessage()]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: AIMessage = {
      type: 'query',
      content: input,
      time: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const queryText = input;
    setInput('');

    // Simulate AI response after a short delay
    setTimeout(() => {
      const response: AIMessage = {
        type: 'response',
        content: simulateAiResponse(queryText),
        time: new Date()
      };
      setMessages(prev => [...prev, response]);
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (query: string) => {
    const userMessage: AIMessage = {
      type: 'query',
      content: query,
      time: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    setTimeout(() => {
      const response: AIMessage = {
        type: 'response',
        content: simulateAiResponse(query),
        time: new Date()
      };
      setMessages(prev => [...prev, response]);
    }, 500);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex flex-col gap-1 ${
              msg.type === 'query' ? 'items-end' : 'items-start'
            }`}
          >
            {msg.type === 'query' ? (
              <div className="px-4 py-3 rounded-xl text-sm leading-relaxed max-w-[90%] bg-blue-500 text-white rounded-br-sm">
                {msg.content}
              </div>
            ) : (
              <div
                className="px-4 py-3 rounded-xl text-sm leading-relaxed max-w-[90%] bg-white border border-gray-200 text-gray-800 rounded-bl-sm [&_ul]:my-2 [&_ul]:pl-5 [&_ul]:list-disc [&_li]:mb-1 [&_strong]:font-semibold [&_em]:text-gray-500"
                dangerouslySetInnerHTML={{ __html: msg.content }}
              />
            )}
            <div className={`text-xs text-gray-400 px-1 ${msg.type === 'query' ? 'text-right' : ''}`}>
              {formatTime(msg.time)}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t bg-white">
        <div className="p-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about patient data..."
            rows={2}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-violet-500 focus:bg-white"
          />
        </div>
        <div className="flex items-center justify-between px-4 pb-4">
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => handleSuggestionClick('What medications is this patient on?')}
              className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-xs text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Medications
            </button>
            <button
              onClick={() => handleSuggestionClick('Summarize recent visits')}
              className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-xs text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Visits
            </button>
            <button
              onClick={() => handleSuggestionClick('What are the care gaps?')}
              className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-xs text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Care gaps
            </button>
          </div>
          <button
            onClick={handleSend}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-500 text-white rounded-lg text-sm font-medium hover:bg-violet-600 transition-colors"
          >
            <Lightbulb size={16} />
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}
