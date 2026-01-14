/**
 * Mock backend endpoint: POST /api/chat
 *
 * Expected request:
 *   POST /api/chat
 *   Content-Type: application/json
 *   Body: { "message": "user message text" }
 *
 * Expected response:
 *   Content-Type: text/event-stream
 *   Body: SSE stream with events:
 *
 *   data: {"type":"text-start","id":"part-1"}
 *   data: {"type":"text-delta","id":"part-1","delta":"Hello"}
 *   data: {"type":"text-delta","id":"part-1","delta":" there"}
 *   data: {"type":"text-delta","id":"part-1","delta":"!"}
 *   data: {"type":"text-end","id":"part-1"}
 *   data: [DONE]
 *
 * For development, you can use a simple Node.js server or proxy to a real endpoint.
 * The frontend code expects this exact SSE format.
 */
export const MOCK_ENDPOINT = '/api/chat';
