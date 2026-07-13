import axios from "axios";
import httpStatus from "http-status";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../environment";
import { AuthContext } from "./authContextObject";

const client = axios.create({
  baseURL: `${API_URL}/api/v1/users`,
});

export const AuthProvider = ({ children }) => {
  const [userData, setUserData] = useState({
    token: localStorage.getItem("token") || null,
    username: null,
  });

  const router = useNavigate();

  // REGISTER → then LOGIN → redirect to /home
  const handleRegister = async (name, username, password) => {
    const res = await client.post("/register", { name, username, password });
    if (res.status === httpStatus.CREATED) {
      const loginRes = await client.post("/login", { username, password });
      if (loginRes.status === httpStatus.OK) {
        localStorage.setItem("token", loginRes.data.token);
        setUserData({ token: loginRes.data.token, username });
        router("/home"); // safe redirect
      }
      return res.data.message;
    }
  };

  // LOGIN
  const handleLogin = async (username, password) => {
    const res = await client.post("/login", { username, password });
    if (res.status === httpStatus.OK) {
      localStorage.setItem("token", res.data.token);
      setUserData({ token: res.data.token, username });
      router("/home"); // safe redirect
    }
  };

  const getHistoryOfUser = async () => {
    const res = await client.get("/get_all_activity", {
      params: { token: localStorage.getItem("token") },
    });
    return res.data;
  };

  const addToUserHistory = async (meetingCode) => {
    const res = await client.post("/add_to_activity", {
      token: localStorage.getItem("token"),
      meeting_code: meetingCode,
    });
    return res.data;
  };

  const data = {
    userData,
    setUserData,
    handleRegister,
    handleLogin,
    getHistoryOfUser,
    addToUserHistory,
  };

  return <AuthContext.Provider value={data}>{children}</AuthContext.Provider>;
};
