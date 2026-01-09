const carsService = require('./cars.service');

async function createCar(req, res) {
  try {
    const { make, model, year, mileage, starting_price } = req.body;
    
    if (!make || !model || !year || !mileage || !starting_price) {
      return res.status(400).json({ error: 'Missing required fields: make, model, year, mileage, starting_price' });
    }
    
    if (year < 1900 || year > new Date().getFullYear() + 1) {
      return res.status(400).json({ error: 'Invalid year' });
    }
    
    if (mileage < 0) {
      return res.status(400).json({ error: 'Mileage must be non-negative' });
    }
    
    if (starting_price <= 0) {
      return res.status(400).json({ error: 'Starting price must be greater than 0' });
    }
    
    const car = await carsService.createCar({
      sellerId: req.user.id,
      make,
      model,
      year,
      mileage,
      startingPrice: starting_price,
    });
    
    res.status(201).json(car);
  } catch (error) {
    console.error('Error creating car:', error);
    res.status(500).json({ error: 'Failed to create car' });
  }
}

async function getAllCars(req, res) {
  try {
    const cars = await carsService.getAllCars();
    res.json(cars);
  } catch (error) {
    console.error('Error fetching cars:', error);
    res.status(500).json({ error: 'Failed to fetch cars' });
  }
}

async function getCarById(req, res) {
  try {
    const { id } = req.params;
    const car = await carsService.getCarById(id);
    
    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }
    
    res.json(car);
  } catch (error) {
    console.error('Error fetching car:', error);
    res.status(500).json({ error: 'Failed to fetch car' });
  }
}

async function updateCar(req, res) {
  try {
    const { id } = req.params;
    const { make, model, year, mileage, starting_price } = req.body;
    
    const car = await carsService.getCarById(id);
    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }
    
    const ownerId = await carsService.getCarOwner(id);
    const isOwner = ownerId === req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You can only update your own cars' });
    }
    
    if (year !== undefined && (year < 1900 || year > new Date().getFullYear() + 1)) {
      return res.status(400).json({ error: 'Invalid year' });
    }
    
    if (mileage !== undefined && mileage < 0) {
      return res.status(400).json({ error: 'Mileage must be non-negative' });
    }
    
    if (starting_price !== undefined && starting_price <= 0) {
      return res.status(400).json({ error: 'Starting price must be greater than 0' });
    }
    
    const updatedCar = await carsService.updateCar(id, {
      make,
      model,
      year,
      mileage,
      startingPrice: starting_price,
    });
    
    res.json(updatedCar);
  } catch (error) {
    console.error('Error updating car:', error);
    res.status(500).json({ error: 'Failed to update car' });
  }
}

async function deleteCar(req, res) {
  try {
    const { id } = req.params;
    
    const car = await carsService.getCarById(id);
    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }
    
    const ownerId = await carsService.getCarOwner(id);
    const isOwner = ownerId === req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own cars' });
    }
    
    await carsService.deleteCar(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting car:', error);
    res.status(500).json({ error: 'Failed to delete car' });
  }
}

module.exports = {
  createCar,
  getAllCars,
  getCarById,
  updateCar,
  deleteCar,
};
