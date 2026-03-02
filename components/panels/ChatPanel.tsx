'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Mic, Paperclip, Clock, Phone, Video, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { usePatient } from '@/lib/context/PatientContext';
import { AppMessage } from '@/lib/types/message';
import { searchFhirThreads, sendFhirMessage } from '@/lib/services/fhir-communication-service';
import { useWhisper } from '@/lib/hooks/useWhisper';

const POLL_INTERVAL_MS = 15_000;

export function ChatPanel() {
  const { user } = useAuth();
  const { activePatient } = usePatient();
  const isFhirPatient = !!activePatient?.fhirId;
  const practitionerId = (user as Record<string, unknown>)?.fhirPractitionerId as string || '';

  const [messages, setMessages] = useState<AppMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sending' | 'error'>('idle');
  const [error, setError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const handleTranscription = useCallback((text: string) => {
    setInput(prev => prev ? prev + ' ' + text : text);
  }, []);

  const {
    isModelLoading,
    isRecording,
    isTranscribing,
    progress,
    error: whisperError,
    toggleRecording,
    clearError: clearWhisperError,
  } = useWhisper(handleTranscription);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch messages for current patient
  const fetchMessages = useCallback(async (showLoading = false) => {
    if (!activePatient?.fhirId) return;

    if (showLoading) setStatus('loading');

    const result = await searchFhirThreads(activePatient.fhirId);

    if (result.error) {
      if (showLoading) {
        setError(result.error);
        setStatus('error');
      }
      return;
    }

    // V1: use first thread
    const thread = result.threads[0];
    if (thread) {
      setThreadId(thread.id);
      setMessages(thread.messages);
    } else {
      setThreadId(null);
      setMessages([]);
    }

    if (showLoading) setStatus('idle');
  }, [activePatient?.fhirId]);

  // Initial fetch + polling
  useEffect(() => {
    if (!isFhirPatient) {
      setMessages([]);
      setThreadId(null);
      setStatus('idle');
      return;
    }

    fetchMessages(true);

    pollRef.current = setInterval(() => {
      fetchMessages(false);
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isFhirPatient, fetchMessages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !activePatient?.fhirId || !practitionerId) return;

    setInput('');
    setStatus('sending');

    // Optimistic update
    const optimisticMsg: AppMessage = {
      id: `optimistic-${Date.now()}`,
      fhirId: '',
      threadId: threadId || '',
      senderType: 'provider',
      senderRef: `Practitioner/${practitionerId}`,
      text,
      sentAt: new Date().toISOString(),
      status: 'completed',
    };
    setMessages(prev => [...prev, optimisticMsg]);

    const result = await sendFhirMessage(
      text,
      activePatient.fhirId,
      practitionerId,
      threadId || undefined
    );

    if (result.success) {
      // Update thread ID if this was the first message
      if (result.threadId && !threadId) {
        setThreadId(result.threadId);
      }
      // Replace optimistic message with server-confirmed data
      if (result.messageId) {
        setMessages(prev =>
          prev.map(m =>
            m.id === optimisticMsg.id
              ? { ...m, id: result.messageId!, fhirId: result.messageId! }
              : m
          )
        );
      }
      setStatus('idle');
    } else {
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setError(result.error || 'Failed to send message');
      setStatus('error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Non-FHIR patient state
  if (!isFhirPatient) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 text-center">
        <p className="text-sm text-gray-500">
          Messages are available for FHIR-connected patients.
        </p>
      </div>
    );
  }

  // Loading state
  if (status === 'loading') {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6">
        <Loader2 size={24} className="animate-spin text-blue-500" />
        <p className="text-sm text-gray-500 mt-2">Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Error banner */}
      {status === 'error' && error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-sm text-red-600 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => { setError(''); setStatus('idle'); fetchMessages(true); }}
            className="text-red-700 font-medium hover:underline ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400">
              No messages yet. Send a message to start a conversation.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOutgoing = msg.senderType === 'provider';
            return (
              <div
                key={msg.id}
                className={`flex flex-col gap-0.5 max-w-[80%] ${
                  isOutgoing ? 'self-end items-end ml-auto' : 'self-start items-start'
                }`}
              >
                <div
                  className={`px-3.5 py-2.5 text-sm leading-relaxed break-words ${
                    isOutgoing
                      ? 'bg-blue-500 text-white rounded-2xl rounded-br-sm'
                      : 'bg-gray-200 text-gray-900 rounded-2xl rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
                <span className={`text-[11px] text-gray-400 px-1 ${isOutgoing ? 'text-right' : ''}`}>
                  {formatTime(msg.sentAt)}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Whisper error banner */}
      {whisperError && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 text-sm text-amber-700 flex items-center justify-between">
          <span>{whisperError}</span>
          <button
            onClick={clearWhisperError}
            className="text-amber-800 font-medium hover:underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="border-t bg-white">
        <div className="px-4 pt-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={2}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:border-blue-500 focus:bg-white"
            disabled={status === 'sending' || isTranscribing}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-2 pb-3">
          <div className="flex gap-0.5">
            <button
              onClick={toggleRecording}
              disabled={isTranscribing || status === 'sending'}
              className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
                isRecording
                  ? 'bg-red-100 text-red-500 hover:bg-red-200'
                  : isTranscribing
                    ? 'text-amber-500 animate-pulse'
                    : isModelLoading
                      ? 'text-blue-400 animate-pulse'
                      : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={
                isRecording ? 'Stop recording' :
                isTranscribing ? 'Transcribing...' :
                isModelLoading ? `Loading model (${progress}%)` :
                'Voice input'
              }
            >
              {isRecording ? (
                <div className="w-3 h-3 bg-red-500 rounded-sm" />
              ) : (
                <Mic size={16} />
              )}
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Attach file">
              <Paperclip size={16} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Schedule">
              <Clock size={16} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Phone call">
              <Phone size={16} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Video call">
              <Video size={16} />
            </button>
          </div>
          <button
            onClick={handleSend}
            disabled={status === 'sending' || !input.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
