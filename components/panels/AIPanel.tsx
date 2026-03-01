'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Lightbulb, Loader2 } from 'lucide-react';
import { usePatient } from '@/lib/context/PatientContext';
import { sendAIMessage } from '@/lib/services/ai-assistant-service';
import type { AIAssistantMessage } from '@/lib/types/ai-assistant';

interface AIMessage {
  type: 'query' | 'response';
  content: string;
  time: Date;
}

function getWelcomeMessage(): AIMessage {
  return {
    type: 'response',
    content: `Welcome! I can help you query information from this patient's record. Try asking about:\n\n• Current medications\n• Recent visit summaries\n• Care gaps and screenings due\n• Lab results and trends`,
    time: new Date(),
  };
}

export function AIPanel() {
  const { activePatient } = usePatient();
  const [messages, setMessages] = useState<AIMessage[]>([getWelcomeMessage()]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<AIAssistantMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reset conversation when patient changes
  useEffect(() => {
    setMessages([getWelcomeMessage()]);
    setConversationHistory([]);
    setInput('');
    setIsLoading(false);
  }, [activePatient?.fhirId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const sendQuery = async (query: string) => {
    if (!activePatient?.fhirId || isLoading) return;

    const userMessage: AIMessage = { type: 'query', content: query, time: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    const result = await sendAIMessage(activePatient.fhirId, query, conversationHistory);

    if (result.success) {
      const response: AIMessage = { type: 'response', content: result.data, time: new Date() };
      setMessages(prev => [...prev, response]);
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: query },
        { role: 'model', content: result.data },
      ]);
    } else {
      const errorMessage: AIMessage = {
        type: 'response',
        content: `Sorry, I encountered an error: ${result.error}`,
        time: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }

    setIsLoading(false);
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    const query = input;
    setInput('');
    sendQuery(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (query: string) => {
    sendQuery(query);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Guard: no patient selected
  if (!activePatient) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 text-center text-gray-500">
        <Lightbulb size={32} className="mb-3 text-gray-300" />
        <p className="text-sm">Open a patient chart to use the AI Assistant.</p>
      </div>
    );
  }

  // Guard: non-FHIR patient (mock patient)
  if (!activePatient.fhirId) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 text-center text-gray-500">
        <Lightbulb size={32} className="mb-3 text-gray-300" />
        <p className="text-sm">AI Assistant is only available for FHIR patients.</p>
        <p className="text-xs mt-1 text-gray-400">This patient does not have a linked FHIR record.</p>
      </div>
    );
  }

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
              <div className="px-4 py-3 rounded-xl text-sm leading-relaxed max-w-[90%] bg-white border border-gray-200 text-gray-800 rounded-bl-sm prose [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            )}
            <div className={`text-xs text-gray-400 px-1 ${msg.type === 'query' ? 'text-right' : ''}`}>
              {formatTime(msg.time)}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="px-4 py-3 rounded-xl text-sm bg-white border border-gray-200 text-gray-500 rounded-bl-sm flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Thinking...
            </div>
          </div>
        )}
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
            disabled={isLoading}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-violet-500 focus:bg-white disabled:opacity-50"
          />
        </div>
        <div className="flex items-center justify-between px-4 pb-4">
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => handleSuggestionClick('What medications is this patient on?')}
              disabled={isLoading}
              className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-xs text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Medications
            </button>
            <button
              onClick={() => handleSuggestionClick('Summarize recent visits')}
              disabled={isLoading}
              className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-xs text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Visits
            </button>
            <button
              onClick={() => handleSuggestionClick('What are the care gaps?')}
              disabled={isLoading}
              className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-xs text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Care gaps
            </button>
          </div>
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-500 text-white rounded-lg text-sm font-medium hover:bg-violet-600 transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Lightbulb size={16} />}
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}
