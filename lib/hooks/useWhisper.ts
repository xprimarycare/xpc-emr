'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseWhisperReturn {
  isModelLoading: boolean;
  isModelReady: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  progress: number;
  error: string | null;
  toggleRecording: () => void;
  loadModel: () => void;
  clearError: () => void;
}

const MAX_RECORDING_MS = 30_000;

async function blobToFloat32Audio(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext({ sampleRate: 16000 });
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const float32 = audioBuffer.getChannelData(0);
  await audioCtx.close();
  return float32;
}

export function useWhisper(onTranscription: (text: string) => void): UseWhisperReturn {
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const maxDurationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTranscriptionRef = useRef(onTranscription);
  onTranscriptionRef.current = onTranscription;

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/whisper-worker.ts', import.meta.url),
        { type: 'module' }
      );

      workerRef.current.addEventListener('message', (e) => {
        const data = e.data;

        switch (data.type) {
          case 'progress':
            if (data.status === 'progress' && typeof data.progress === 'number') {
              setProgress(Math.round(data.progress));
            }
            if (data.status === 'initiate') {
              setIsModelLoading(true);
            }
            break;

          case 'ready':
            setIsModelLoading(false);
            setIsModelReady(true);
            setProgress(100);
            break;

          case 'result':
            setIsTranscribing(false);
            if (data.text) {
              onTranscriptionRef.current(data.text);
            }
            break;

          case 'error':
            setIsModelLoading(false);
            setIsTranscribing(false);
            setError(data.message || 'An error occurred');
            break;
        }
      });
    }
    return workerRef.current;
  }, []);

  const loadModel = useCallback(() => {
    const worker = getWorker();
    if (!isModelReady && !isModelLoading) {
      setIsModelLoading(true);
      worker.postMessage({ type: 'load' });
    }
  }, [getWorker, isModelReady, isModelLoading]);

  const stopRecording = useCallback(() => {
    if (maxDurationRef.current) {
      clearTimeout(maxDurationRef.current);
      maxDurationRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);

    const worker = getWorker();
    if (!isModelReady && !isModelLoading) {
      worker.postMessage({ type: 'load' });
      setIsModelLoading(true);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000 },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        if (chunksRef.current.length === 0) return;

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        chunksRef.current = [];

        setIsTranscribing(true);
        try {
          const float32Audio = await blobToFloat32Audio(blob);
          worker.postMessage(
            { type: 'transcribe', audio: float32Audio },
            [float32Audio.buffer]
          );
        } catch {
          setIsTranscribing(false);
          setError('Failed to process audio');
        }
      };

      recorder.start();
      setIsRecording(true);

      maxDurationRef.current = setTimeout(() => {
        stopRecording();
      }, MAX_RECORDING_MS);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Microphone permission denied');
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        setError('No microphone found');
      } else {
        setError('Failed to access microphone');
      }
    }
  }, [getWorker, isModelReady, isModelLoading, stopRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    return () => {
      if (maxDurationRef.current) {
        clearTimeout(maxDurationRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  return {
    isModelLoading,
    isModelReady,
    isRecording,
    isTranscribing,
    progress,
    error,
    toggleRecording,
    loadModel,
    clearError,
  };
}
