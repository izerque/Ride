const auctionsService = require('./auctions.service');

async function createAuction(req, res) {
  try {
    const { car_id, start_time, end_time, reserve_price } = req.body;
    
    if (!car_id || !start_time || !end_time) {
      return res.status(400).json({ error: 'Missing required fields: car_id, start_time, end_time' });
    }
    
    const startTime = new Date(start_time);
    const endTime = new Date(end_time);
    const now = new Date();
    
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    
    if (startTime >= endTime) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }
    
    if (startTime < now) {
      return res.status(400).json({ error: 'Start time cannot be in the past' });
    }
    
    const car = await auctionsService.getCarOwner(car_id);
    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }
    
    if (car !== req.user.id) {
      return res.status(403).json({ error: 'You can only auction your own cars' });
    }
    
    const existingAuctions = await auctionsService.checkExistingAuctionForCar(car_id);
    if (existingAuctions.length > 0) {
      return res.status(400).json({ error: 'Car already has an active or upcoming auction' });
    }
    
    const overlappingAuctions = await auctionsService.checkOverlappingAuctions(car_id, startTime, endTime);
    if (overlappingAuctions.length > 0) {
      return res.status(400).json({ error: 'Auction time overlaps with an existing auction for this car' });
    }
    
    const startingPrice = await auctionsService.getCarStartingPrice(car_id);
    const reservePriceValue = reserve_price || startingPrice;
    
    if (reservePriceValue <= 0) {
      return res.status(400).json({ error: 'Reserve price must be greater than 0' });
    }
    
    const auction = await auctionsService.createAuction({
      carId: car_id,
      startTime,
      endTime,
      reservePrice: reservePriceValue,
    });
    
    const auctionWithState = {
      ...auction,
      state: auctionsService.computeAuctionState(auction.start_time, auction.end_time),
      starting_price: startingPrice,
    };
    
    res.status(201).json(auctionWithState);
  } catch (error) {
    console.error('Error creating auction:', error);
    if (error.code === '23503') {
      return res.status(404).json({ error: 'Car not found' });
    }
    res.status(500).json({ error: 'Failed to create auction' });
  }
}

async function getAllAuctions(req, res) {
  try {
    const auctions = await auctionsService.getAllAuctions();
    res.json(auctions);
  } catch (error) {
    console.error('Error fetching auctions:', error);
    res.status(500).json({ error: 'Failed to fetch auctions' });
  }
}

async function getAuctionById(req, res) {
  try {
    const { id } = req.params;
    const auction = await auctionsService.getAuctionById(id);
    
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }
    
    res.json(auction);
  } catch (error) {
    console.error('Error fetching auction:', error);
    res.status(500).json({ error: 'Failed to fetch auction' });
  }
}

module.exports = {
  createAuction,
  getAllAuctions,
  getAuctionById,
};
