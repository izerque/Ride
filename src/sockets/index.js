const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const auctionSocket = require('./auction.socket');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

function initializeSocketIO(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = {
        id: decoded.id,
        role: decoded.role,
      };
      
      console.log(`✅ Socket authenticated: User ${decoded.id} (${decoded.role})`);
      next();
    } catch (error) {
      console.error('❌ Socket authentication failed:', error.message);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id} (User: ${socket.user.id})`);

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} (Reason: ${reason})`);
    });

    socket.on('error', (error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error);
    });

    auctionSocket(io, socket);
  });

  return io;
}

module.exports = initializeSocketIO;
