import { Server } from "socket.io";
import { getCorsWhitelist, buildCorsOriginCheck } from "../utils/cors.js";

let connections = {};
let messages = {};
let timeOnline = {};

export const connectToServer = (server) => {
  // Read (and validate) the whitelist when the server actually starts,
  // not at module-import time — dotenv.config() in app.js may not have
  // populated process.env yet if this ran at import time instead.
  const io = new Server(server, {
    cors: {
      origin: buildCorsOriginCheck(getCorsWhitelist()),
      methods: ["GET", "POST"],
      allowedHeaders: ["*"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {

    // JOIN CALL
    socket.on("join-call", (path) => {

      if (!connections[path]) connections[path] = [];
      connections[path].push(socket.id);

      timeOnline[socket.id] = new Date();

      // Notify all users in room, including the existing member list
      // so the new peer (and everyone else) can set up connections correctly.
      for (let a = 0; a < connections[path].length; a++) {
        io.to(connections[path][a]).emit("user-joined", socket.id, connections[path]);
      }

      // Send previous messages
      if (messages[path]) {
        for (let a = 0; a < messages[path].length; a++) {
          const msg = messages[path][a];
          io.to(socket.id).emit("chat-message", msg.data, msg.sender, msg["socket-id-sender"]);
        }
      }
    });

    // SIGNAL (WebRTC)
    socket.on("signal", (toID, message) => {
      io.to(toID).emit("signal", socket.id, message);
    });

    // CHAT MESSAGE
    socket.on("chat-message", (data, sender) => {

      const [matchingRoom, found] = Object.entries(connections).reduce(
        ([room, isFound], [roomKey, roomValue]) => {
          if (!isFound && roomValue.includes(socket.id)) return [roomKey, true];
          return [room, isFound];
        },
        ["", false]
      );

      if (found) {
        if (!messages[matchingRoom]) messages[matchingRoom] = [];
        messages[matchingRoom].push({ sender, data, "socket-id-sender": socket.id });

        connections[matchingRoom].forEach((elem) => {
          io.to(elem).emit("chat-message", data, sender, socket.id);
        });
      }
    });

    // DISCONNECT
    socket.on("disconnect", () => {
      const diffTime = Math.abs(new Date() - timeOnline[socket.id]);
      delete timeOnline[socket.id];

      for (const [key, arr] of Object.entries(connections)) {
        const index = arr.indexOf(socket.id);
        if (index !== -1) {
          // Notify others
          for (let a = 0; a < connections[key].length; a++) {
            io.to(connections[key][a]).emit("user-left", socket.id);
          }

          // Remove socket from room
          connections[key].splice(index, 1);

          // Delete room (and its chat history) once empty, so memory
          // doesn't grow unbounded across the server's lifetime.
          if (connections[key].length === 0) {
            delete connections[key];
            delete messages[key];
          }
        }
      }
    });
  });

  return io;
};
