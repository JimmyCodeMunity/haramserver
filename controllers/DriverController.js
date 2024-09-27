const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const Driver = require("../model/DriverModel");

// if (process.env.NODE_ENV !== "PRODUCTION") {
//     require("dotenv").config({
//       path: "../.env",
//     });
//   }

const jwttoken = process.env.JWT_SECRET;

//register new user
const createDriver = async (req, res) => {
  try {
    const { name, email, password, address, phone ,carmodel,registration,photo} = req.body;
    const existingUser = await Driver.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: "User already exists"});
      
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await Driver.create({
        name,
        email,
        address,
        password: hashedPassword,
        phone,
        carmodel,
        registration,
        photo
      });
      res.status(200).json({message:"user account created successfully",user})
    }
  } catch (error) {
    console.log("error creating new user:", error);
    res.status(500).json({ message: error.message });
    return;
  }
};

// login user
const driverLogin = async(req,res)=>{
    try {
        const {email,password} = req.body;
        console.log(email,password)
        const user = await Driver.findOne({email});

        if(!user){
            return res.status(400).json({message:"User not found"});
        }
        const isMatch = await bcrypt.compare(password,user.password);
        if(!isMatch){
            return res.status(400).json({message:"Invalid credentials"});
        }
        else{
            const token = jwt.sign({email:user.email}, jwttoken);
            if(res.status(200)){
              console.log("login successfull")
                return res.send({status:"ok",data:token})
            }else{
                return res.send({error:"error"})
            }
        }
        
    } catch (error) {
      console.log("error",error)
        
    }
}


// get userdata
const getDriverData = async(req,res)=>{
  const {token} = req.body;
  try {
    const user = await jwt.verify(token,jwttoken)
    const useremail = user.email;
    const userdata = await Driver.findOne({email:useremail})
    if(!userdata){
      return res.status(400).json({message:"User not found"})
    }
    console.log(userdata)
    res.status(200).json({message:"User data fetched successfully", userdata})
    
    
  } catch (error) {
    console.log("error getting user data:", error);
    res.status(500).json({ message: error.message });
    return;
    
  }
}


module.exports = {
    createDriver,
    driverLogin,
    getDriverData
}
