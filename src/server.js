// server
require('dotenv').config();
const http = require('http');
const app = require('./app');
const initializeSocketIO = require('./sockets');
const { getRedisClient } = require('./redis/redisClient');

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

async function startServer() {
  try {
    await getRedisClient();
    
    initializeSocketIO(server);
    
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔌 Socket.io ready for connections`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

