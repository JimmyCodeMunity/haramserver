const { urlencoded } = require("body-parser");
const express = require("express");
const { createUser, userLogin, getUserData, findOnlineDrivers } = require("../controllers/UserController");
const router = express.Router();

router.use(express.urlencoded({ extended: true }));
router.use(express.json());

router.post('/createuser',createUser)
router.post('/userlogin',userLogin)
router.post('/getuserdata',getUserData)
router.get('/getonlinedrivers',findOnlineDrivers)

module.exports = router;
