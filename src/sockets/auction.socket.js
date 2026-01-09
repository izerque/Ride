const auctionRealtimeService = require('../services/auctionRealtime.service');
const bidsService = require('../bids/bids.service');
const auctionsService = require('../auctions/auctions.service');
const pool = require('../db');

const activeAuctionTimers = new Map();

function getRoomName(auctionId) {
  return `auction:${auctionId}`;
}

function startAuctionTimer(io, auctionId, initialEndTime) {
  if (activeAuctionTimers.has(auctionId)) {
    clearInterval(activeAuctionTimers.get(auctionId));
  }

  const checkInterval = setInterval(async () => {
    try {
      const timer = await auctionRealtimeService.getAuctionTimer(auctionId);
      
      if (!timer) {
        clearInterval(activeAuctionTimers.get(auctionId));
        activeAuctionTimers.delete(auctionId);
        return;
      }

      const now = new Date();
      const endTime = new Date(timer);
      
      if (now >= endTime) {
        await endAuction(io, auctionId);
        clearInterval(activeAuctionTimers.get(auctionId));
        activeAuctionTimers.delete(auctionId);
      }
    } catch (error) {
      console.error(`Error in auction timer for ${auctionId}:`, error);
    }
  }, 1000);

  activeAuctionTimers.set(auctionId, checkInterval);
}

async function endAuction(io, auctionId) {
  try {
    const result = await auctionRealtimeService.endAuction(auctionId);
    const roomName = getRoomName(auctionId);
    
    io.to(roomName).emit('auctionEnded', {
      auctionId,
      winnerId: result.winnerId,
      winningAmount: result.winningAmount,
      timestamp: new Date().toISOString(),
    });
    
    console.log(`🏁 Auction ${auctionId} ended. Winner: ${result.winnerId}, Amount: ${result.winningAmount}`);
  } catch (error) {
    console.error(`Error ending auction ${auctionId}:`, error);
    const roomName = getRoomName(auctionId);
    io.to(roomName).emit('error', {
      message: 'Failed to end auction',
      auctionId,
    });
  }
}

async function getUserName(userId) {
  try {
    const query = 'SELECT name FROM users WHERE id = $1';
    const { rows } = await pool.query(query, [userId]);
    return rows[0]?.name || 'Unknown';
  } catch (error) {
    return 'Unknown';
  }
}

module.exports = function auctionSocket(io, socket) {
  socket.on('joinAuction', async (data) => {
    try {
      const { auctionId } = data;
      
      if (!auctionId) {
        socket.emit('error', { message: 'auctionId is required' });
        return;
      }

      const auction = await auctionsService.getAuctionById(auctionId);
      if (!auction) {
        socket.emit('error', { message: 'Auction not found', auctionId });
        return;
      }

      const roomName = getRoomName(auctionId);
      await socket.join(roomName);
      
      console.log(`👤 User ${socket.user.id} joined auction ${auctionId}`);

      const state = auctionsService.computeAuctionState(auction.start_time, auction.end_time);
      
      let status = await auctionRealtimeService.getAuctionStatus(auctionId);
      
      if (state === 'upcoming') {
        if (!status) {
          await auctionRealtimeService.initializeAuctionInRedis(auction);
        }
        const startTime = new Date(auction.start_time);
        const now = new Date();
        const timeUntilStart = startTime.getTime() - now.getTime();
        
        setTimeout(async () => {
          const roomName = getRoomName(auctionId);
          io.to(roomName).emit('auctionStarted', {
            auctionId,
            startTime: auction.start_time,
            endTime: auction.end_time,
            startingPrice: auction.starting_price,
          });
          startAuctionTimer(io, auctionId, auction.end_time);
        }, timeUntilStart);
      } else if (state === 'live') {
        if (!status) {
          await auctionRealtimeService.initializeAuctionInRedis(auction);
          status = await auctionRealtimeService.getAuctionStatus(auctionId);
        }
        
        const timer = await auctionRealtimeService.getAuctionTimer(auctionId);
        const endTime = timer ? new Date(timer) : new Date(auction.end_time);
        startAuctionTimer(io, auctionId, endTime);
        
        socket.emit('auctionStarted', {
          auctionId,
          startTime: auction.start_time,
          endTime: endTime.toISOString(),
          startingPrice: auction.starting_price,
        });
      } else if (state === 'ended') {
        socket.emit('auctionEnded', {
          auctionId,
          message: 'Auction has already ended',
        });
      }

      status = await auctionRealtimeService.getAuctionStatus(auctionId);
      if (status) {
        socket.emit('auctionStatus', {
          auctionId,
          status: status.status,
          highestBid: status.highestBid,
          remainingSeconds: status.remainingSeconds,
        });
      }
    } catch (error) {
      console.error('Error in joinAuction:', error);
      socket.emit('error', { message: 'Failed to join auction' });
    }
  });

  socket.on('placeBid', async (data) => {
    try {
      const { auctionId, amount } = data;
      
      if (!auctionId || !amount) {
        socket.emit('error', { message: 'auctionId and amount are required' });
        return;
      }

      if (typeof amount !== 'number' || amount <= 0) {
        socket.emit('error', { message: 'Amount must be a positive number' });
        return;
      }

      console.log(`💰 Bid attempt: User ${socket.user.id} on auction ${auctionId} for ${amount}`);

      const validation = await auctionRealtimeService.validateBid(
        auctionId,
        socket.user.id,
        amount,
        socket.user.role
      );

      if (!validation.valid) {
        socket.emit('error', { 
          message: validation.error,
          auctionId,
        });
        console.log(`❌ Bid rejected: ${validation.error}`);
        return;
      }

      const userName = await getUserName(socket.user.id);
      const result = await auctionRealtimeService.processBid(
        auctionId,
        socket.user.id,
        amount,
        userName
      );

      if (!result) {
        socket.emit('error', {
          message: 'Bid processing failed. Please try again.',
          auctionId,
        });
        return;
      }

      const roomName = getRoomName(auctionId);
      const bidData = {
        auctionId,
        amount: result.bid.amount,
        bidderId: result.bid.bidderId,
        bidderName: result.bid.bidderName,
        timestamp: result.bid.timestamp,
      };

      io.to(roomName).emit('newBid', bidData);
      console.log(`✅ Bid accepted: ${amount} by ${userName} on auction ${auctionId}`);

      if (result.extended && result.newEndTime) {
        const auction = await auctionsService.getAuctionById(auctionId);
        if (auction) {
          const updateQuery = `
            UPDATE auctions
            SET end_time = $1
            WHERE id = $2;
          `;
          await pool.query(updateQuery, [result.newEndTime, auctionId]);
          
          io.to(roomName).emit('auctionExtended', {
            auctionId,
            newEndTime: result.newEndTime,
            extendedBy: 30,
          });
          
          startAuctionTimer(io, auctionId, result.newEndTime);
          console.log(`⏰ Auction ${auctionId} extended by 30 seconds`);
        }
      }
    } catch (error) {
      console.error('Error in placeBid:', error);
      socket.emit('error', {
        message: 'Failed to place bid',
        auctionId: data?.auctionId,
      });
    }
  });

  socket.on('leaveAuction', async (data) => {
    try {
      const { auctionId } = data;
      if (auctionId) {
        const roomName = getRoomName(auctionId);
        await socket.leave(roomName);
        console.log(`👤 User ${socket.user.id} left auction ${auctionId}`);
      }
    } catch (error) {
      console.error('Error in leaveAuction:', error);
    }
  });
};
