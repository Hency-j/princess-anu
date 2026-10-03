const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static('public'));

const state = {
  players: { princess: null, anu: null },
  hands: { princess: false, anu: false },
  seated: { princess: false, anu: false },
  orders: { princess: [], anu: [] },
  bites: { princess: null, anu: null },
  paid: false,
  proposalAnswer: null,
  phase: 'login'
};

function broadcast() { io.emit('state', state); }
function resetForUser(user) {
  state.players[user] = null;
  state.hands[user] = false;
  state.seated[user] = false;
  state.orders[user] = [];
  state.bites[user] = null;
  if (!state.players.princess && !state.players.anu) {
    state.paid = false; state.proposalAnswer = null; state.phase = 'login';
  }
}

io.on('connection', socket => {
  socket.on('login', ({name, password}) => {
    const user = name?.toLowerCase();
    const valid = (user === 'princess' || user === 'anu') && password === 'iloveyou';
    if (!valid) return socket.emit('loginError', 'Wrong name or password 💔');
    if (state.players[user] && state.players[user] !== socket.id) return socket.emit('loginError', 'That character is already inside the restaurant 💕');
    state.players[user] = socket.id;
    socket.data.user = user;
    state.phase = 'gate';
    socket.emit('loginSuccess', user);
    broadcast();
  });

  socket.on('holdHands', value => {
    const user = socket.data.user; if (!user) return;
    state.hands[user] = !!value;
    if (state.hands.princess && state.hands.anu) state.phase = 'sit';
    broadcast();
  });

  socket.on('sit', value => {
    const user = socket.data.user; if (!user) return;
    state.seated[user] = !!value;
    if (state.seated.princess && state.seated.anu) state.phase = 'menu';
    broadcast();
  });

  socket.on('order', items => {
    const user = socket.data.user; if (!user || !Array.isArray(items)) return;
    state.orders[user] = items.slice(0, 10);
    if (state.orders.princess.length && state.orders.anu.length) state.phase = 'food';
    broadcast();
  });

  socket.on('bite', who => {
    const user = socket.data.user; if (!user || !['self','love'].includes(who)) return;
    state.bites[user] = who;
    if (state.bites.princess && state.bites.anu) state.phase = 'eating';
    broadcast();
  });

  socket.on('pay', () => {
    const user = socket.data.user; if (!user) return;
    if (user === 'princess') return socket.emit('payMessage', 'Princess should only enjoy the food, not pay. 👑💗');
    state.paid = true; state.phase = 'proposal'; broadcast();
  });

  socket.on('proposal', answer => {
    const user = socket.data.user; if (user !== 'princess' || !['yes','no'].includes(answer)) return;
    state.proposalAnswer = answer;
    if (answer === 'yes') state.phase = 'exit';
    broadcast();
  });

  socket.on('disconnect', () => {
    const user = socket.data.user;
    if (user && state.players[user] === socket.id) resetForUser(user);
    broadcast();
  });
});

server.listen(process.env.PORT || 3000, () => console.log('Princess & Anu restaurant running on http://localhost:3000'));
