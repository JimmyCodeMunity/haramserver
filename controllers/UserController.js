const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const User = require("../model/UserModel");
const jwt = require('jsonwebtoken');
const Driver = require("../model/DriverModel");

// if (process.env.NODE_ENV !== "PRODUCTION") {
//     require("dotenv").config({
//       path: "../.env",
//     });
//   }

const jwttoken = process.env.JWT_SECRET;

//register new user
const createUser = async (req, res) => {
  try {
    const { name, email, password, address, phone } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: "User already exists"});
      
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({
        name,
        email,
        password: hashedPassword,
        address,
        phone,
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
const userLogin = async(req,res)=>{
    try {
        const {email,password} = req.body;
        console.log(email,password)
        const user = await User.findOne({email});

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
        
    }
}


// get userdata
const getUserData = async(req,res)=>{
  const {token} = req.body;
  try {
    const user = await jwt.verify(token,jwttoken)
    const useremail = user.email;
    const userdata = await User.findOne({email:useremail})
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


const findOnlineDrivers= async(req,res)=>{
  try {
    const onlineDrivers = await Driver.find({ isOnline: true });
    // console.log("found driver", onlineDrivers);
    res.status(200).json(onlineDrivers)
    
  } catch (error) {
    console.log("error gettings drivers",error)
    res.status(401).json({message:error.message})
    
  }
}


const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ message: "User data fetched successfully", user });
  } catch (error) {
    console.error("Error getting user data", error);
    res.status(500).json({ error: "Failed to get user data." });
  }
};


module.exports = {
    createUser,
    userLogin,
    getUserData,
    findOnlineDrivers,
    getUserById
}
