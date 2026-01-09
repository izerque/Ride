const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../auth/auth.middleware');
const carsController = require('./cars.controller');

router.post('/', requireAuth, requireRole('seller'), carsController.createCar);
router.get('/', carsController.getAllCars);
router.get('/:id', carsController.getCarById);
router.put('/:id', requireAuth, carsController.updateCar);
router.delete('/:id', requireAuth, carsController.deleteCar);

module.exports = router;
