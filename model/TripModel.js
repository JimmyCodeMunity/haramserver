// models/Trip.js
const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  userId: String,
  driverId: String,
  startLocation: { coordinates: [Number] },
  destinationLocation: { coordinates: [Number] },
  distance: Number, // in meters
  price: Number, // price in your preferred currency
  status: { type: String, default: 'pending' }, // 'pending', 'accepted', 'completed'
  timeEstimate: Number, // time in minutes
});

const Trip = mongoose.model('Trip', tripSchema);
module.exports = Trip;
