import type { StreamEvent } from './types';

// Parse SSE line format: "data: {...json...}"
function parseSSELine(line: string): StreamEvent | null {
  if (!line.startsWith('data: ')) return null;
  const jsonStr = line.slice(6).trim();
  if (jsonStr === '[DONE]') return null;  // Stream end marker
  return JSON.parse(jsonStr) as StreamEvent;
}

// Process ReadableStream chunks, splitting on newlines
export async function* parseStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Split on newlines, keeping incomplete lines in buffer
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (line) {
          const event = parseSSELine(line);
          if (event) yield event;
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const event = parseSSELine(buffer.trim());
      if (event) yield event;
    }
  } finally {
    reader.releaseLock();
  }
}
