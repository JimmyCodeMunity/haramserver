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
const GOOGLE_MAPS_API_KEY = "AIzaSyDdUQ1EIQJB46n2RSusQro1qP3Pd4mGZcA";

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

// Track drivers' sockets
const drivers = new Map(); // This will hold the driverId and their corresponding socket ID
const users = new Map(); // This will hold the driverId and their corresponding socket ID

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
  socket.on("driver-go-online", async ({ driverId, location }) => {
    // console.log("long", location.longitude);
    // console.log("lat", location.latitude);

    // return;
    if (location) {
      console.log("driverid", driverId);
      console.log("location", location);
      console.log("request", "go online req");
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
      console.log(driver);
      drivers.set(driverId, socket.id);

      io.emit("driver-online", driver);
    }
  });

  socket.on("disconnect", () => {
    console.log(`user ${socket.id} disconnected`);

    // Remove driver from the map when they disconnect
    for (let [driverId, socketId] of drivers.entries()) {
      if (socketId === socket.id) {
        drivers.delete(driverId);
        break;
      }
    }
  });

  // driver offline mode
  socket.on("driver-go-offline", async ({ driverId, location }) => {
    console.log("driverid", driverId);
    console.log("curretlocation", location);
    console.log("request", "go offline req");

    // return;
    if (location) {
      const driver = await Driver.findByIdAndUpdate(
        driverId,
        {
          isOnline: false,
          location: {
            type: "Point",
            coordinates: [location.longitude, location.latitude],
          },
        },
        { new: true }
      );
      console.log(driver);

      io.emit("driver-offline", driver);
    }
  });

  // socket.on("driver-location-update", async (driverId, location) => {
  //   console.log("new location", location);
  //   if(location){
  //     console.log("new location", location);
  //     const driver = await Driver.findByIdAndUpdate(
  //       driverId,
  //       {
  //         location: {
  //           type: "Point",
  //           coordinates: [location.longitude, location.latitude],
  //         },
  //       },
  //       { new: true }
  //     );

  //     io.emit("driver-location-changed", driver);
  //   }
  // });

  socket.on("driver-location-update", async (data) => {
    const { driverId, location } = data;
    if (location && location.latitude && location.longitude) {
      // console.log(`Driver ${driverId} moved to:`, location);
      // Update location in database or broadcast to nearby users
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
      // console.log("driver w new locaion",driver)

      io.emit("driver-location-changed", driver);
    } else {
      console.error(`Invalid location data from driver ${driverId}`);
    }
  });

  // socket.on(
  //   "find-driver",
  //   async ({ userId, startLocation, destinationLocation }) => {
  //     console.log("userid" + userId);
  //     console.log("startLocationlat" + startLocation.latitude);
  //     console.log("startLocationlong" + startLocation.longitude);
  //     console.log("destinationLocation" + destinationLocation.latitude);
  //     const onlineDrivers = await Driver.find({ isOnline: true });
  //     console.log("found driver", onlineDrivers);

  //     const distance = geolib.getDistance(
  //       {
  //         latitude: startLocation.latitude,
  //         longitude: startLocation.longitude,
  //       },
  //       {
  //         latitude: destinationLocation.latitude,
  //         longitude: destinationLocation.longitude,
  //       }
  //     );

  //     console.log(`Distance between start and destination: ${distance} meters`);
  //     calculatePrice(distance);

  //     // Calculate distances for each driver
  //     if (onlineDrivers.length > 0) {
  //       console.log("online now",onlineDrivers)
  //       const closestDriver = onlineDrivers.reduce((prev, current) => {
  //         const currentDistance = geolib.getDistance(
  //           { latitude: startLocation.latitude, longitude: startLocation.longitude },
  //           { latitude: current.location.coordinates[1], longitude: current.location.coordinates[0] }
  //         );
  //         const prevDistance = geolib.getDistance(
  //           { latitude: startLocation.latitude, longitude: startLocation.longitude },
  //           { latitude: prev.location.coordinates[1], longitude: prev.location.coordinates[0] }
  //         );
  //         console.log("whatever this is",currentDistance < prevDistance ? current : prev)
  //         return currentDistance < prevDistance ? current : prev;
  //       });

  //       if (closestDriver) {
  //         const trip = new Trip({
  //           userId,
  //           driverId: closestDriver._id,
  //           startLocation,
  //           destinationLocation,
  //           distance: geolib.getDistance(startLocation, destinationLocation),
  //         });

  //         // Call Google Maps API for time and distance
  //         const response = await axios.get(
  //           `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${startLocation.lat},${startLocation.lng}&destinations=${destinationLocation.lat},${destinationLocation.lng}&key="AIzaSyDdUQ1EIQJB46n2RSusQro1qP3Pd4mGZcA"`
  //         );

  //         const distanceInMeters =
  //           response.data.rows[0].elements[0].distance.value;
  //         const timeInMinutes =
  //           response.data.rows[0].elements[0].duration.value / 60;
  //         const tripPrice = calculatePrice(distanceInMeters); // Custom function

  //         trip.distance = distanceInMeters;
  //         trip.timeEstimate = timeInMinutes;
  //         trip.price = tripPrice;
  //         await trip.save();

  //         // Notify the driver and the user
  //         socket.to(closestDriver._id).emit("trip-request", trip);
  //         socket.emit("trip-accepted", trip);
  //       }
  //     }

  //     // Assuming we found a driver
  //   }
  // );

  // Handle driver accepting or rejecting trip
  socket.on("driver-accept-trip", async (tripId) => {
    const trip = await Trip.findByIdAndUpdate(
      tripId,
      { status: "accepted" },
      { new: true }
    );
    io.emit("trip-status-update", trip);
  });

  socket.on("accept-trip", async ({ tripId }) => {
    console.log("Driver accepted trip:", tripId);

    const trip = await Trip.findById(tripId);
    if (trip) {
      trip.status = "accepted";
      await trip.save();
      console.log("accepted trip", trip);

      // Notify the user that the trip has been accepted
      const userSocketId = users.get(trip.userId.toString());
      users.set(userSocketId, socket.id);
      console.log("user order", userSocketId);
      if (userSocketId) {
        io.to(userSocketId).emit("trip-acceptedbydriver", trip);
      }

      console.log(
        `Driver accepted the trip and user ${trip.userId} has been notified.`
      );
    } else {
      console.error("Trip not found!");
    }
  });
  socket.on("start-trip", async ({ tripId }) => {
    console.log("Driver Started trip:", tripId);

    const trip = await Trip.findById(tripId);
    if (trip) {
      trip.status = "accepted";
      // console.log("trip acceted is",trip)
      // return
      // await trip.save();
      console.log("started trip", trip);
      console.log("started user", trip.userId.toString());

      // Notify the user that the trip has been accepted
      const userSocketId = users.get(trip.userId.toString());
      console.log("user socket",userSocketId)
      if (userSocketId) {
        users.set(userSocketId, socket.id);
        console.log("user order", userSocketId);
      } else {
        console.log("error setting order id");
      }

      // if (userSocketId) {
      //   io.to(userSocketId).emit("trip-acceptedbydriver", trip);
      // }

      console.log(
        `Driver started the trip and user ${trip.userId} has been notified.`
      );
    } else {
      console.error("Trip not found!");
    }
  });

  // socket.on("reject-trip", async ({ tripId }) => {
  //   console.log("Driver rejected trip:", tripId);

  //   const trip = await Trip.findById(tripId);
  //   if (trip) {
  //     trip.status = "rejected";
  //     await trip.save();

  //     // Notify the user that the trip has been rejected
  //     const userSocketId = users.get(trip.userId.toString());
  //     if (userSocketId) {
  //       io.to(userSocketId).emit("trip-rejected", trip);
  //     }

  //     // Clear the driver’s socket to prevent further requests
  //     const driverSocketId = drivers.get(trip.driverId.toString());
  //     if (driverSocketId) {
  //       drivers.delete(trip.driverId.toString()); // Remove the driver from the active list
  //       console.log(`Driver ${trip.driverId} removed from active sockets.`);
  //     }

  //     console.log(
  //       `Driver rejected the trip and user ${trip.userId} has been notified.`
  //     );
  //   } else {
  //     console.error("Trip not found!");
  //   }
  // });

  socket.on("reject-trip", async ({ tripId }) => {
    console.log("Driver rejected trip:", tripId);

    const trip = await Trip.findById(tripId);
    if (trip) {
      trip.status = "rejected";
      await trip.save();

      // Notify the user that the trip has been rejected
      const userSocketId = users.get(trip.userId.toString());
      if (userSocketId) {
        io.to(userSocketId).emit("trip-rejected", trip);
      }

      console.log(
        `Driver rejected the trip and user ${trip.userId} has been notified.`
      );
    } else {
      console.error("Trip not found!");
    }
  });

  const rejectedDriversMap = new Map(); // Keep track of drivers who rejected each trip

  // Handle driver rejection
  // socket.on("reject-trip", async ({ tripId, driverId }) => {
  //   console.log(`Driver ${driverId} rejected trip: ${tripId}`);

  //   const trip = await Trip.findById(tripId);
  //   if (trip) {
  //     trip.status = "rejected";
  //     await trip.save();

  //     // Update rejected drivers list
  //     if (!rejectedDriversMap.has(tripId)) {
  //       rejectedDriversMap.set(tripId, new Set());
  //     }
  //     rejectedDriversMap.get(tripId).add(driverId);

  //     // Find and assign the next closest driver
  //     await assignDriverToTrip({
  //       userId: trip.userId,
  //       startLocation: trip.startLocation,
  //       destinationLocation: trip.destinationLocation,
  //       rejectedDrivers: rejectedDriversMap.get(tripId),
  //     });
  //   } else {
  //     console.error("Trip not found!");
  //   }
  // });

  // handle rejected rides

  // socket.on(
  //   "find-driver",
  //   async ({ userId, startLocation, destinationLocation }) => {
  //     users[userId] = socket.id;
  //     console.log(`User ${userId} has been assigned socket ID: ${socket.id}`);
  //     console.log("userid" + userId);
  //     console.log("startLocationlat" + startLocation.latitude);
  //     console.log("startLocationlong" + startLocation.longitude);
  //     console.log("destinationLocation" + destinationLocation.latitude);

  //     const onlineDrivers = await Driver.find({ isOnline: true });
  //     console.log("found driver", onlineDrivers);

  //     const distance = geolib.getDistance(
  //       {
  //         latitude: startLocation.latitude,
  //         longitude: startLocation.longitude,
  //       },
  //       {
  //         latitude: destinationLocation.latitude,
  //         longitude: destinationLocation.longitude,
  //       }
  //     );

  //     console.log(`Distance between start and destination: ${distance} meters`);
  //     calculatePrice(distance);

  //     if (onlineDrivers.length > 0) {
  //       const closestDriver = onlineDrivers.reduce((prev, current) => {
  //         const currentDistance = geolib.getDistance(
  //           {
  //             latitude: startLocation.latitude,
  //             longitude: startLocation.longitude,
  //           },
  //           {
  //             latitude: current.location.coordinates[1],
  //             longitude: current.location.coordinates[0],
  //           }
  //         );
  //         const prevDistance = geolib.getDistance(
  //           {
  //             latitude: startLocation.latitude,
  //             longitude: startLocation.longitude,
  //           },
  //           {
  //             latitude: prev.location.coordinates[1],
  //             longitude: prev.location.coordinates[0],
  //           }
  //         );
  //         return currentDistance < prevDistance ? current : prev;
  //       });

  //       if (closestDriver) {
  //         const trip = new Trip({
  //           userId,
  //           driverId: closestDriver._id,
  //           startLocation,
  //           destinationLocation,
  //           distance: geolib.getDistance(startLocation, destinationLocation),
  //         });

  //         // Call Google Maps API for time and distance
  //         try {
  //           console.log("api key", GOOGLE_MAPS_API_KEY);
  //           const response = await axios.get(
  //             `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${startLocation.latitude},${startLocation.longitude}&destinations=${destinationLocation.latitude},${destinationLocation.longitude}&key=${GOOGLE_MAPS_API_KEY}`
  //           );

  //           // Validate the response structure
  //           if (
  //             response.data.rows &&
  //             response.data.rows[0] &&
  //             response.data.rows[0].elements &&
  //             response.data.rows[0].elements[0]
  //           ) {
  //             const distanceInMeters =
  //               response.data.rows[0].elements[0].distance.value;
  //             const timeInMinutes =
  //               response.data.rows[0].elements[0].duration.value / 60;
  //             const tripPrice = calculatePrice(distanceInMeters);

  //             trip.distance = distanceInMeters;
  //             trip.timeEstimate = timeInMinutes;
  //             trip.price = tripPrice;
  //             await trip.save();

  //             // Notify the driver and the user
  //             // socket.to(closestDriver._id).emit("new-trip", trip);
  //             // socket.emit("trip-accepted", trip);
  //             const driverSocketId = drivers.get(closestDriver._id.toString());
  //             console.log("selected driver", driverSocketId);

  //             if (driverSocketId) {
  //               // Emit the trip request only to the closest driver
  //               io.to(driverSocketId).emit("trip-request", trip);
  //               socket.emit("trip-accepted", trip);
  //             } else {
  //               console.error(`Driver ${closestDriver._id} is offline`);
  //             }
  //           } else {
  //             console.error(
  //               "Invalid response structure from Google API",
  //               response.data
  //             );
  //             socket.emit("error", {
  //               message: "Unable to calculate distance/time.",
  //             });
  //           }
  //         } catch (error) {
  //           console.error("Error calling Google Maps API:", error);
  //           socket.emit("error", {
  //             message: "Failed to get distance and time from Google Maps API.",
  //           });
  //         }
  //       }
  //     }
  //   }
  // );

  socket.on(
    "find-driver",
    async ({ userId, startLocation, destinationLocation, from, to }) => {
      users.set(userId, socket.id);
      console.log(`User ${userId} has been assigned socket ID: ${socket.id}`);

      // Store rejected drivers in a Set, initially empty
      const rejectedDrivers = new Set();

      console.log("userid" + userId);
      console.log("startLocationlat" + startLocation.latitude);
      console.log("startLocationlong" + startLocation.longitude);
      console.log("destinationLocation" + destinationLocation.latitude);

      const onlineDrivers = await Driver.find({ isOnline: true });
      console.log("found driver", onlineDrivers);

      // Fetch distance and time from Google Maps API
      try {
        const response = await axios.get(
          `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${startLocation.latitude},${startLocation.longitude}&destinations=${destinationLocation.latitude},${destinationLocation.longitude}&key=${GOOGLE_MAPS_API_KEY}`
        );

        if (
          response.data.rows &&
          response.data.rows[0] &&
          response.data.rows[0].elements &&
          response.data.rows[0].elements[0]
        ) {
          const distanceInMeters =
            response.data.rows[0].elements[0].distance.value;
          const timeInMinutes =
            response.data.rows[0].elements[0].duration.value / 60;
          const tripPrice = calculatePrice(distanceInMeters);

          // Proceed to find the closest driver and handle rejection
          await assignDriverToTrip({
            userId,
            startLocation,
            destinationLocation,
            distanceInMeters,
            timeInMinutes,
            tripPrice,
            rejectedDrivers,
            from,
            to,
          });
        } else {
          console.error(
            "Invalid response structure from Google API",
            response.data
          );
          socket.emit("error", {
            message: "Unable to calculate distance/time.",
          });
        }
      } catch (error) {
        console.error("Error calling Google Maps API:", error);
        socket.emit("error", {
          message: "Failed to get distance and time from Google Maps API.",
        });
      }
    }
  );

  async function assignDriverToTrip({
    userId,
    startLocation,
    destinationLocation,
    distanceInMeters,
    timeInMinutes,
    tripPrice,
    rejectedDrivers,
    from,
    to,
  }) {
    // Find online drivers that haven't rejected the trip
    const onlineDrivers = await Driver.find({
      isOnline: true,
      _id: { $nin: Array.from(rejectedDrivers) }, // Exclude drivers who have rejected
    });

    if (onlineDrivers.length > 0) {
      const validDrivers = onlineDrivers.filter(
        (driver) =>
          driver.location &&
          driver.location.coordinates &&
          driver.location.coordinates.length === 2
      );

      if (validDrivers.length === 0) {
        console.error("No drivers with valid locations.");
        return;
      }

      const closestDriver = validDrivers.reduce((prev, current) => {
        const prevDistance = geolib.getDistance(
          {
            latitude: startLocation.latitude,
            longitude: startLocation.longitude,
          },
          {
            latitude: prev.location.coordinates[1],
            longitude: prev.location.coordinates[0],
          }
        );
        const currentDistance = geolib.getDistance(
          {
            latitude: startLocation.latitude,
            longitude: startLocation.longitude,
          },
          {
            latitude: current.location.coordinates[1],
            longitude: current.location.coordinates[0],
          }
        );
        return currentDistance < prevDistance ? current : prev;
      });

      if (closestDriver) {
        console.log(`Assigning driver ${closestDriver._id} to trip`);

        const trip = new Trip({
          userId,
          driverId: closestDriver._id,
          startLocation: {
            coordinates: [startLocation.latitude, startLocation.longitude],
          },
          destinationLocation: {
            coordinates: [
              destinationLocation.latitude,
              destinationLocation.longitude,
            ],
          },
          distance: distanceInMeters,
          timeEstimate: timeInMinutes,
          price: tripPrice,
          from: from,
          to: to,
        });

        await trip.save();

        const driverSocketId = drivers.get(closestDriver._id.toString());
        if (driverSocketId) {
          io.to(driverSocketId).emit("trip-request", trip);
          socket.emit("trip-accepted", trip);
        } else {
          console.error(`Driver ${closestDriver._id} is offline`);
        }
      }
    } else {
      console.log("No available drivers for the trip.");
      const userSocketId = users.get(userId.toString());
      if (userSocketId) {
        io.to(userSocketId).emit("no-drivers-available", { userId });
      }
    }
  }

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
const { default: axios } = require("axios");

//api routes
app.use("/api/v1/user/", userroutes);
app.use("/api/v1/driver", driverroutes);
