import { io } from 'socket.io-client';

const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

// BUG-015 fix: removed transports restriction — allow Socket.IO's default polling→websocket upgrade
// for better resilience across proxies and corporate networks
export const socket = io(socketUrl, {
  autoConnect: false,
});
