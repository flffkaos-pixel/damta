import { ChatRoom } from '../_chat-room.js';

// WebSocket endpoint: /api/ws
// Forwards WebSocket upgrade to the singleton ChatRoom Durable Object
export async function onRequest(context) {
  if (context.request.headers.get('Upgrade') !== 'websocket') {
    return new Response('Expected WebSocket upgrade', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const id = context.env.CHAT_ROOM.idFromName('main');
  const obj = context.env.CHAT_ROOM.get(id);
  return obj.fetch(context.request);
}
