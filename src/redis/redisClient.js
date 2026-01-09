const { createClient } = require('redis');

let redisClient = null;

async function getRedisClient() {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  redisClient = createClient({
    url: redisUrl,
  });

  redisClient.on('error', (err) => {
    console.error('❌ Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    console.log('🔄 Redis connecting...');
  });

  redisClient.on('ready', () => {
    console.log('✅ Redis connected');
  });

  redisClient.on('reconnecting', () => {
    console.log('🔄 Redis reconnecting...');
  });

  try {
    await redisClient.connect();
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    throw error;
  }

  return redisClient;
}

async function closeRedisClient() {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    redisClient = null;
  }
}

process.on('SIGINT', async () => {
  await closeRedisClient();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeRedisClient();
  process.exit(0);
});

module.exports = {
  getRedisClient,
  closeRedisClient,
};
