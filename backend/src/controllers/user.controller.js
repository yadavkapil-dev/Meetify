// backend/src/controllers/user.controller.js
import httpStatus from "http-status";
import { User } from "../models/users.model.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { Meeting } from "../models/meeting.model.js";

// LOGIN (no auto-register)
const login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Please provide username & password" });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = crypto.randomBytes(20).toString("hex");
    user.token = token;
    await user.save();

    return res.status(200).json({ token });
  } catch (e) {
    console.error("[LOGIN] error:", e);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

// REGISTER
const register = async (req, res) => {
  const { name, username, password } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ message: "Please provide name, username & password" });
  }

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(httpStatus.CONFLICT).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, username, password: hashedPassword });
    await newUser.save();

    res.status(httpStatus.CREATED).json({ message: "User Registered" });
  } catch (e) {
    console.error("[REGISTER] error:", e);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

// GET USER HISTORY
const getUserHistory = async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const user = await User.findOne({ token });
    if (!user) return res.status(401).json({ message: "Not authenticated" });

    const meetings = await Meeting.find({ user_id: user.username }).sort({ date: -1 });
    res.json(meetings);
  } catch (e) {
    console.error("[GET_HISTORY] error:", e);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

// ADD TO HISTORY
const addToHistory = async (req, res) => {
  const { token, meeting_code } = req.body;
  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (!meeting_code || !meeting_code.trim()) {
    return res.status(400).json({ message: "Please provide a meeting code" });
  }

  try {
    const user = await User.findOne({ token });
    if (!user) return res.status(401).json({ message: "Not authenticated" });

    const newMeeting = new Meeting({ user_id: user.username, meetingCode: meeting_code.trim() });
    await newMeeting.save();

    res.status(201).json({ message: "Added code to history" });
  } catch (e) {
    console.error("[ADD_HISTORY] error:", e);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

export { login, register, getUserHistory, addToHistory };
