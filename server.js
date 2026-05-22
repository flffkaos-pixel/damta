const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
app.use(express.static(path.join(__dirname, 'public')));

const ROOMS = [
  { id: 'rooftop', name: '옥상', icon: '🌙' },
  { id: 'cafe', name: '카페', icon: '☕' },
  { id: 'park', name: '공원', icon: '🌳' },
  { id: 'room', name: '방', icon: '🛋️' },
  { id: 'beach', name: '바닷가', icon: '🌊' },
];
const roomUsers = {};
ROOMS.forEach(r => roomUsers[r.id] = { count: 0, users: {} });

let totalCigarettes = 0;
let statsDate = new Date().toDateString();

const adjectives = ['귀여운', '졸린', '배고픈', '심심한', '신비한', '용감한', '게으른', '행복한', '슬픈', '촉촉한', '따뜻한', '시원한', '달콤한', '짭짤한', '아기', '어른', '철든', '철없는'];
const nouns = ['토끼', '고양이', '강아지', '여우', '판다', '곰', '올빼미', '다람쥐', '펭귄', '코알라', '호랑이', '사자', '고래', '나비', '별', '달', '구름', '햇살', '바람', '눈꽃'];

function randomNickname() {
  const a = adjectives[Math.floor(Math.random() * adjectives.length)];
  const n = nouns[Math.floor(Math.random() * nouns.length)];
  return a + n + Math.floor(Math.random() * 100);
}

function getTotalOnline() {
  let total = 0;
  for (const rid in roomUsers) total += roomUsers[rid].count || 0;
  return total;
}

function broadcastStats() {
  const now = new Date().toDateString();
  if (now !== statsDate) { totalCigarettes = 0; statsDate = now; }
  io.emit('stats', { online: getTotalOnline(), cigarettes: totalCigarettes });
}

io.on('connection', (socket) => {
  const nickname = randomNickname();
  let currentRoom = 'rooftop';

  // Auto-join default room
  socket.join(currentRoom);
  roomUsers[currentRoom].users[socket.id] = { nickname, joined: Date.now() };
  roomUsers[currentRoom].count = Object.keys(roomUsers[currentRoom].users).length;
  io.to(currentRoom).emit('user-count', { roomId: currentRoom, count: roomUsers[currentRoom].count });

  socket.emit('init', { nickname, rooms: ROOMS, defaultRoom: currentRoom });
  broadcastStats();

  socket.on('join-room', (roomId) => {
    if (currentRoom) {
      socket.leave(currentRoom);
      if (roomUsers[currentRoom]) {
        delete roomUsers[currentRoom].users[socket.id];
        roomUsers[currentRoom].count = Object.keys(roomUsers[currentRoom].users).length;
      }
      io.to(currentRoom).emit('user-count', { roomId: currentRoom, count: roomUsers[currentRoom]?.count || 0 });
    }
    currentRoom = roomId;
    socket.join(roomId);
    if (!roomUsers[roomId]) roomUsers[roomId] = { count: 0, users: {} };
    roomUsers[roomId].users[socket.id] = { nickname, joined: Date.now() };
    roomUsers[roomId].count = Object.keys(roomUsers[roomId].users).length;
    io.to(roomId).emit('user-count', { roomId, count: roomUsers[roomId].count });
    socket.emit('room-changed', { roomId });
    broadcastStats();
  });

  socket.on('chat-msg', (data) => {
    const msg = (data.text || '').trim().substring(0, 500);
    if (!msg) return;
    io.to(currentRoom).emit('chat-msg', { nickname, text: msg, time: Date.now(), id: socket.id });
  });

  socket.on('cigarette-done', () => {
    totalCigarettes++;
    broadcastStats();
  });

  socket.on('disconnect', () => {
    if (currentRoom && roomUsers[currentRoom]) {
      delete roomUsers[currentRoom].users[socket.id];
      roomUsers[currentRoom].count = Object.keys(roomUsers[currentRoom].users).length;
      io.to(currentRoom).emit('user-count', { roomId: currentRoom, count: roomUsers[currentRoom].count });
    }
    broadcastStats();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌙 OnlineDamta 서버 실행 중: http://localhost:${PORT}`);
});
