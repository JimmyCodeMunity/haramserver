const { urlencoded } = require("body-parser");
const express = require("express");
const { createDriver, driverLogin, getDriverData } = require("../controllers/DriverController");
const router = express.Router();

router.use(express.urlencoded({ extended: true }));
router.use(express.json());

router.post('/createdriver',createDriver)
router.post('/driverlogin',driverLogin)
router.post('/getdriverdata',getDriverData)

module.exports = router;
