const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const geolib = require("geolib");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

if (process.env.NODE_ENV !== "PRODUCTION") {
  require("dotenv").config({
    path: "./.env",
  });
}

const server = http.createServer(app);

// const io = new Server(server, {
//   cors: {
//     origin: [
//       "http://localhost:3000",
//       "http://192.168.1.130:8000",
//       "http://localhost:3001",
//       "https://cbfe-41-139-202-31.ngrok-free.app",
//       "exp://192.168.1.130:8081"
//     ], // Add multiple origins here
//     methods: ["GET", "POST"],
//   },
// });

const io = new Server(server, {
  cors: {
    // origin: ["http://localhost:3000", "http://localhost:3001","https://cbfe-41-139-202-31.ngrok-free.app"], // Add multiple origins here
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// environment variable
const port = 8000;
// const port = process.env.PORT || 8000;
const dbconn = process.env.DB_URL;

server.listen(port, (req, res) => {
  console.log(`Server is running on port ${port}`);
});

//connect to db
mongoose
  .connect(dbconn, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("Connected to db");
  })
  .catch((error) => {
    console.error("Error connecting to db", error);
  });

app.get("/", (req, res) => {
  res.send("Api is running dawg");
});

// Track driver's location
io.on("connection", (socket) => {
  console.log(`user ${socket.id} connected`);

  socket.on("send_message", (data) => {
    // console.log("roomdata",data.room)
    console.log("message", data);
    socket.broadcast.emit("receive_message", data);
    // socket.to(data.room).emit("receive_message",data)
  });


  // driver onlinemode
  socket.on("driver-go-online", async ({driverId, location}) => {
    console.log("driverid", driverId);
    console.log("location", location);
    // console.log("long", location.longitude);
    // console.log("lat", location.latitude);

    // return;
    if(location){
      const driver = await Driver.findByIdAndUpdate(
        driverId,
        {
          isOnline: true,
          location: {
            type: "Point",
            coordinates: [location.longitude, location.latitude],
          },
        },
        { new: true }
      );
      console.log(driver)
  
      io.emit("driver-online", driver);
    }
  });


  // driver offline mode
  socket.on("driver-go-offline", async ({driverId, location}) => {
    console.log("driverid", driverId);
    console.log("curretlocation", location);

    // return;
    const driver = await Driver.findByIdAndUpdate(
      driverId,
      {
        isOnline: false,
        location: {
          type: "Point",
          coordinates: [],
        },
      },
      { new: true }
    );
    console.log(driver)

    io.emit("driver-offline", driver);
  });

  socket.on("driver-location-update", async (driverId, location) => {
    const driver = await Driver.findByIdAndUpdate(
      driverId,
      {
        location: {
          type: "Point",
          coordinates: [location.longitude, location.latitude],
        },
      },
      { new: true }
    );

    io.emit("driver-location-changed", driver);
  });

  socket.on(
    "find-driver",
    async ({ userId, startLocation, destinationLocation }) => {
      console.log("userid" + userId);
      console.log("startLocation" + startLocation.longitude);
      console.log("destinationLocation" + destinationLocation.latitude);
      const onlineDrivers = await Driver.find({ isOnline: true });
      console.log("found driver", onlineDrivers);

      const distance = geolib.getDistance(
        {
          latitude: startLocation.latitude,
          longitude: startLocation.longitude,
        },
        {
          latitude: destinationLocation.latitude,
          longitude: destinationLocation.longitude,
        }
      );

      console.log(`Distance between start and destination: ${distance} meters`);
      calculatePrice(distance);

      // Calculate distances for each driver
      if (onlineDrivers > 0) {
        const closestDriver = onlineDrivers.reduce((prev, current) => {
          const currentDistance = geolib.getDistance(
            startLocation,
            current.location.coordinates
          );
          const prevDistance = geolib.getDistance(
            startLocation,
            prev.location.coordinates
          );
          return currentDistance < prevDistance ? current : prev;
        });

        if (closestDriver) {
          const trip = new Trip({
            userId,
            driverId: closestDriver._id,
            startLocation,
            destinationLocation,
            distance: geolib.getDistance(startLocation, destinationLocation),
          });

          // Call Google Maps API for time and distance
          const response = await axios.get(
            `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${startLocation.lat},${startLocation.lng}&destinations=${destinationLocation.lat},${destinationLocation.lng}&key="AIzaSyDdUQ1EIQJB46n2RSusQro1qP3Pd4mGZcA"`
          );

          const distanceInMeters =
            response.data.rows[0].elements[0].distance.value;
          const timeInMinutes =
            response.data.rows[0].elements[0].duration.value / 60;
          const tripPrice = calculatePrice(distanceInMeters); // Custom function

          trip.distance = distanceInMeters;
          trip.timeEstimate = timeInMinutes;
          trip.price = tripPrice;
          await trip.save();

          // Notify the driver and the user
          socket.to(closestDriver._id).emit("trip-request", trip);
          socket.emit("trip-accepted", trip);
        }
      }

      // Assuming we found a driver
    }
  );

  // Handle driver accepting or rejecting trip
  socket.on("driver-accept-trip", async (tripId) => {
    const trip = await Trip.findByIdAndUpdate(
      tripId,
      { status: "accepted" },
      { new: true }
    );
    io.emit("trip-status-update", trip);
  });

  socket.on("driver-reject-trip", async (tripId) => {
    const trip = await Trip.findByIdAndUpdate(
      tripId,
      { status: "rejected" },
      { new: true }
    );
    io.emit("trip-status-update", trip);
  });
});

// Function to calculate price
function calculatePrice(distance) {
  const baseFare = 50; // Base fare price
  const perKmRate = 20; // Price per km
  const fare = baseFare + (distance / 1000) * perKmRate;
  console.log("fare", fare);
  return fare;
}

//routes
const userroutes = require("./routes/UserRoutes");
const driverroutes = require("./routes/DriverRoutes");
const Trip = require("./model/TripModel");
const Driver = require("./model/DriverModel");

//api routes
app.use("/api/v1/user/", userroutes);
app.use("/api/v1/driver", driverroutes);
