import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

env.allowLocalModels = false;

const MODEL = 'onnx-community/whisper-base';

async function createPipeline(
  progressCallback?: (data: { status: string; progress?: number; file?: string }) => void
): Promise<AutomaticSpeechRecognitionPipeline> {
  const opts = {
    dtype: 'q4' as const,
    progress_callback: progressCallback,
  };

  // @ts-expect-error -- pipeline() produces a union type too complex for TS to represent
  const create = (device: 'webgpu' | 'wasm') => pipeline('automatic-speech-recognition', MODEL, {
    ...opts,
    device,
  }) as Promise<AutomaticSpeechRecognitionPipeline>;

  try {
    return await create('webgpu');
  } catch {
    // WebGPU unavailable — fall back to WASM
    return await create('wasm');
  }
}

let instancePromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

function getInstance(
  progressCallback?: (data: { status: string; progress?: number; file?: string }) => void
): Promise<AutomaticSpeechRecognitionPipeline> {
  if (!instancePromise) {
    instancePromise = createPipeline(progressCallback);
  }
  return instancePromise;
}

type WorkerMessage =
  | { type: 'load' }
  | { type: 'transcribe'; audio: Float32Array };

self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { type } = event.data;

  if (type === 'load') {
    try {
      await getInstance((data) => {
        self.postMessage({ type: 'progress', ...data });
      });
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to load model',
      });
    }
    return;
  }

  if (type === 'transcribe') {
    try {
      const transcriber = await getInstance();
      const result = await transcriber(event.data.audio, {
        language: 'en',
        task: 'transcribe',
      });
      const text = Array.isArray(result) ? result[0].text : result.text;
      self.postMessage({ type: 'result', text: text.trim() });
    } catch (error) {
      self.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Transcription failed',
      });
    }
    return;
  }
});
