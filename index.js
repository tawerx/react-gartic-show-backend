const { checkPrimeSync } = require('crypto');
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);
const cors = require('cors');

app.use(express.json());
app.use(cors());

app.get('/messages', (req, res) => {
  res.json(config.get('messages'));
});

app.get('/canvas', (req, res) => {
  res.json(config.get('canvasImage'));
});

const config = new Map([
  ['users', []],
  ['messages', []],
  ['gameWord', ''],
  ['canvasImage', ''],
]);

const checkRole = () => {
  const users = config.get('users');
  if (users.length == 1 && users[0].role == 'user') {
    console.log('Сработало');
    users[0].role = 'writer';
    config.set('users', users);
    io.to(users[0].id).emit('role', users[0].role);
  }
};

const checkGameWord = (msg, userId) => {
  if (msg.toLowerCase() == config.get('gameWord').toLowerCase()) {
    const users = config.get('users');
    const findItem = users.findIndex((obj) => obj.role == 'writer');
    users[findItem].role = 'user';
    const newWriter = users.findIndex((obj) => obj.id == userId);
    users[newWriter].role = 'writer';
    config.set('gameWord', '');
    config.set('users', users);
    io.to(userId).emit('role', users[newWriter].role);
    io.to(users[findItem].id).emit('role', users[findItem].role);
    io.emit('endGame', { nick: users[newWriter].nick, message: 'Отгадал загаданное слово' });
    io.emit('clearCanvas');
    config.set('gameWord', '');
    config.set('canvasImage', '');
    io.emit('getUsers', config.get('users'));
    console.log(config);
  }
};

const checkDisconnect = () => {
  const users = config.get('users');
  const findItem = users.findIndex((obj) => obj.role == 'writer');
  console.log(users.length);
  if (users.length >= 2) {
    if (findItem == -1) {
      const randomNum = Math.floor(Math.random() * users.length);
      users[randomNum].role = 'writer';
      config.set('users', users);
      io.emit('clearCanvas');
      config.set('gameWord', '');
      config.set('canvasImage', '');
      io.to(users[randomNum].id).emit('role', users[randomNum].role);
    }
  }
};

io.on('connection', (socket) => {
  console.log('user connected ' + socket.id);
  socket.on('nickname', (nick) => {
    const user = {
      id: socket.id,
      nick: nick,
      role: config.get('users').length == 0 ? 'writer' : 'user',
    };
    const users = config.get('users');
    users.push(user);
    config.set('users', users);
    socket.emit('role', user.role);
    io.emit('getUsers', config.get('users'));
  });
  socket.on('coor', (data) => {
    socket.broadcast.emit('paintCoord', data);
  });
  socket.on('clearCanvas', (data) => {
    socket.broadcast.emit('clearCanvas', data);
  });
  socket.on('sendMessage', (data) => {
    const messages = config.get('messages');
    messages.push(data);
    config.set('messages', messages);
    checkGameWord(data.slice(data.indexOf(':') + 2), socket.id);
    socket.broadcast.emit('getMessage', data);
  });
  socket.on('setGameWord', (data) => {
    config.set('gameWord', data);
  });

  socket.on('canvasImg', (data) => {
    config.set('canvasImage', data);
    socket.broadcast.emit('canvasImg', data);
  });

  socket.on('disconnect', () => {
    console.log('user dissconected ' + socket.id);
    const users = config.get('users');
    const findItem = users.findIndex((obj) => obj.id == socket.id);
    users.splice(findItem, 1);
    config.set('users', users);

    checkRole();
    console.log(config.get('users').length);
    checkDisconnect();
    io.emit('getUsers', config.get('users'));
  });
});

server.listen(process.env.PORT || 3005, () => {
  console.log('server started');
});
