const { getRedisClient } = require('../redis/redisClient');
const bidsService = require('../bids/bids.service');
const auctionsService = require('../auctions/auctions.service');
const pool = require('../db');

const ANTI_SNIPE_SECONDS = 30;
const EXTEND_BY_SECONDS = 30;

async function getAuctionState(auctionId) {
  const redis = await getRedisClient();
  const key = `auction:${auctionId}:state`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

async function setAuctionState(auctionId, state) {
  const redis = await getRedisClient();
  const key = `auction:${auctionId}:state`;
  await redis.set(key, JSON.stringify(state));
}

async function getHighestBid(auctionId) {
  const redis = await getRedisClient();
  const key = `auction:${auctionId}:highestBid`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

async function setHighestBid(auctionId, bidData) {
  const redis = await getRedisClient();
  const key = `auction:${auctionId}:highestBid`;
  await redis.set(key, JSON.stringify(bidData));
}

async function getAuctionTimer(auctionId) {
  const redis = await getRedisClient();
  const key = `auction:${auctionId}:timer`;
  const data = await redis.get(key);
  return data ? parseInt(data, 10) : null;
}

async function setAuctionTimer(auctionId, endTime) {
  const redis = await getRedisClient();
  const key = `auction:${auctionId}:timer`;
  const endTimeMs = new Date(endTime).getTime();
  await redis.set(key, endTimeMs.toString());
}

async function extendAuctionTimer(auctionId, extendBySeconds = EXTEND_BY_SECONDS) {
  const redis = await getRedisClient();
  const key = `auction:${auctionId}:timer`;
  const currentEndTime = await redis.get(key);
  
  if (currentEndTime) {
    const newEndTime = parseInt(currentEndTime, 10) + (extendBySeconds * 1000);
    await redis.set(key, newEndTime.toString());
    return new Date(newEndTime);
  }
  
  return null;
}

async function initializeAuctionInRedis(auction) {
  const auctionId = auction.id;
  const startTime = new Date(auction.start_time);
  const endTime = new Date(auction.end_time);
  const now = new Date();
  
  const state = {
    auctionId,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    status: auctionsService.computeAuctionState(auction.start_time, auction.end_time),
  };
  
  await setAuctionState(auctionId, state);
  await setAuctionTimer(auctionId, endTime);
  
  const highestBid = await bidsService.getHighestBid(auctionId);
  if (highestBid) {
    const bidQuery = `
      SELECT bidder_id, amount, created_at
      FROM bids
      WHERE auction_id = $1
      ORDER BY amount DESC
      LIMIT 1;
    `;
    const { rows } = await pool.query(bidQuery, [auctionId]);
    if (rows[0]) {
      await setHighestBid(auctionId, {
        amount: parseFloat(rows[0].amount),
        bidderId: rows[0].bidder_id,
        bidderName: null,
        timestamp: rows[0].created_at,
      });
    }
  } else {
    await setHighestBid(auctionId, {
      amount: parseFloat(auction.starting_price),
      bidderId: null,
      bidderName: null,
      timestamp: null,
    });
  }
}

async function validateBid(auctionId, userId, amount, userRole) {
  const auction = await bidsService.getAuctionById(auctionId);
  if (!auction) {
    return { valid: false, error: 'Auction not found' };
  }
  
  if (userRole !== 'buyer') {
    return { valid: false, error: 'Only buyers can place bids' };
  }
  
  if (auction.seller_id === userId) {
    return { valid: false, error: 'Seller cannot bid on own auction' };
  }
  
  const state = auctionsService.computeAuctionState(auction.start_time, auction.end_time);
  if (state !== 'live') {
    return { valid: false, error: `Auction is not live. Current state: ${state}` };
  }
  
  const redis = await getRedisClient();
  const lockKey = `auction:${auctionId}:bid:lock`;
  const lockValue = `${userId}-${Date.now()}`;
  const lockTtl = 5;
  
  try {
    const lockAcquired = await redis.set(lockKey, lockValue, {
      EX: lockTtl,
      NX: true,
    });
    
    if (!lockAcquired) {
      return { valid: false, error: 'Another bid is being processed. Please try again.' };
    }
    
    const highestBidData = await getHighestBid(auctionId);
    const minimumBid = highestBidData ? highestBidData.amount : parseFloat(auction.starting_price);
    
    if (amount <= minimumBid) {
      await redis.del(lockKey);
      return { 
        valid: false, 
        error: `Bid must be greater than ${minimumBid}` 
      };
    }
    
    return { valid: true, minimumBid };
  } catch (error) {
    await redis.del(lockKey).catch(() => {});
    throw error;
  }
}

async function processBid(auctionId, userId, amount, userName) {
  const redis = await getRedisClient();
  const lockKey = `auction:${auctionId}:bid:lock`;
  
  try {
    const highestBidData = await getHighestBid(auctionId);
    const auction = await bidsService.getAuctionById(auctionId);
    const minimumBid = highestBidData ? highestBidData.amount : parseFloat(auction.starting_price);
    
    if (amount <= minimumBid) {
      await redis.del(lockKey);
      return null;
    }
    
    const now = new Date();
    const newBidData = {
      amount,
      bidderId: userId,
      bidderName: userName,
      timestamp: now.toISOString(),
    };
    
    await setHighestBid(auctionId, newBidData);
    
    const timer = await getAuctionTimer(auctionId);
    if (timer) {
      const remainingMs = timer - now.getTime();
      const remainingSeconds = Math.floor(remainingMs / 1000);
      
      if (remainingSeconds <= ANTI_SNIPE_SECONDS) {
        const newEndTime = await extendAuctionTimer(auctionId, EXTEND_BY_SECONDS);
        await redis.del(lockKey);
        return {
          bid: newBidData,
          extended: true,
          newEndTime: newEndTime ? newEndTime.toISOString() : null,
        };
      }
    }
    
    await redis.del(lockKey);
    return {
      bid: newBidData,
      extended: false,
      newEndTime: null,
    };
  } catch (error) {
    await redis.del(lockKey).catch(() => {});
    throw error;
  }
}

async function endAuction(auctionId) {
  try {
    const highestBidData = await getHighestBid(auctionId);
    const auction = await bidsService.getAuctionById(auctionId);
    
    if (!auction) {
      return null;
    }
    
    const updateQuery = `
      UPDATE auctions
      SET status = 'ended'
      WHERE id = $1;
    `;
    await pool.query(updateQuery, [auctionId]);
    
    if (highestBidData && highestBidData.bidderId) {
      const existingBidQuery = `
        SELECT id FROM bids
        WHERE auction_id = $1 AND bidder_id = $2 AND amount = $3
        LIMIT 1;
      `;
      const { rows: existingBids } = await pool.query(existingBidQuery, [
        auctionId,
        highestBidData.bidderId,
        highestBidData.amount,
      ]);
      
      if (existingBids.length === 0) {
        await bidsService.createBid({
          auctionId,
          bidderId: highestBidData.bidderId,
          amount: highestBidData.amount,
        });
      }
    }
    
    const redis = await getRedisClient();
    await redis.del(`auction:${auctionId}:state`);
    await redis.del(`auction:${auctionId}:highestBid`);
    await redis.del(`auction:${auctionId}:timer`);
    
    return {
      winnerId: highestBidData?.bidderId || null,
      winningAmount: highestBidData?.amount || auction.starting_price,
    };
  } catch (error) {
    console.error('Error ending auction:', error);
    throw error;
  }
}

async function getAuctionStatus(auctionId) {
  const state = await getAuctionState(auctionId);
  const highestBid = await getHighestBid(auctionId);
  const timer = await getAuctionTimer(auctionId);
  
  if (!state) {
    return null;
  }
  
  const now = new Date();
  const endTime = timer ? new Date(timer) : new Date(state.endTime);
  const remainingMs = Math.max(0, endTime.getTime() - now.getTime());
  const currentStatus = now < new Date(state.startTime) 
    ? 'upcoming' 
    : (now >= new Date(state.startTime) && now <= endTime) 
      ? 'live' 
      : 'ended';
  
  return {
    ...state,
    status: currentStatus,
    highestBid,
    remainingMs,
    remainingSeconds: Math.floor(remainingMs / 1000),
    endTime: endTime.toISOString(),
  };
}

module.exports = {
  initializeAuctionInRedis,
  validateBid,
  processBid,
  endAuction,
  getAuctionStatus,
  getHighestBid,
  getAuctionTimer,
  extendAuctionTimer,
};
