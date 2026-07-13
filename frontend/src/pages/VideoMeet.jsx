import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import io from "socket.io-client";
import {
  Alert,
  Badge,
  Button,
  CircularProgress,
  IconButton,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";
import styles from "../styles/video.module.css";
import { SOCKET_URL } from "../environment";

const server_url = SOCKET_URL;

const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// Placeholder stream (black frame + silent audio) swapped in whenever the
// user turns their camera/mic off mid-call, so peers keep receiving a
// well-formed (just disabled) track instead of losing the connection.
const createBlackSilence = ({ width = 640, height = 480 } = {}) => {
  const canvas = Object.assign(document.createElement("canvas"), { width, height });
  canvas.getContext("2d").fillRect(0, 0, width, height);
  const videoTrack = canvas.captureStream().getVideoTracks()[0];
  videoTrack.enabled = false;

  const audioCtx = new AudioContext();
  const oscillator = audioCtx.createOscillator();
  const destination = audioCtx.createMediaStreamDestination();
  oscillator.connect(destination);
  oscillator.start();
  const audioTrack = destination.stream.getAudioTracks()[0];
  audioTrack.enabled = false;

  return new MediaStream([videoTrack, audioTrack]);
};

export default function VideoMeetComponent() {
  const navigate = useNavigate();
  const { url: meetingCodeFromRoute } = useParams();

  const socketRef = useRef(null);
  const socketIdRef = useRef(null);
  const connectionsRef = useRef({});
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const showChatRef = useRef(false);

  const [videoAvailable, setVideoAvailable] = useState(true);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const [screenAvailable, setScreenAvailable] = useState(false);

  const [video, setVideo] = useState(true);
  const [audio, setAudio] = useState(true);
  const [screen, setScreen] = useState(false);

  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState("");
  const [meetingCodeInput, setMeetingCodeInput] = useState("");
  const [videos, setVideos] = useState([]);

  const [mediaError, setMediaError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [connecting, setConnecting] = useState(false);

  const needsManualCode = !(meetingCodeFromRoute || "").trim();
  const meetingCode = needsManualCode
    ? meetingCodeInput.trim()
    : meetingCodeFromRoute.trim();

  useEffect(() => {
    showChatRef.current = showChat;
  }, [showChat]);

  // Ask for camera/mic permission exactly once on mount — previously this
  // ran on every render (missing dependency array), which kept re-acquiring
  // the camera/mic and flickering the hardware indicator during a call.
  useEffect(() => {
    requestPermissions();
    return () => {
      cleanupCall();
    };
  }, []);

  const requestPermissions = async () => {
    let hasVideo = false;
    let hasAudio = false;

    try {
      const probe = await navigator.mediaDevices.getUserMedia({ video: true });
      probe.getTracks().forEach((track) => track.stop());
      hasVideo = true;
    } catch {
      hasVideo = false;
    }

    try {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach((track) => track.stop());
      hasAudio = true;
    } catch {
      hasAudio = false;
    }

    setVideoAvailable(hasVideo);
    setAudioAvailable(hasAudio);
    setVideo(hasVideo);
    setAudio(hasAudio);
    setScreenAvailable(typeof navigator.mediaDevices.getDisplayMedia === "function");

    if (!hasVideo && !hasAudio) {
      setMediaError(
        "Camera and microphone access were denied. You can still join, but others won't see or hear you until you allow access in your browser's site settings."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: hasVideo, audio: hasAudio });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch {
      setMediaError("Couldn't access your camera or microphone. Please check your browser permissions.");
    }
  };

  // Swaps the outgoing stream on every active peer connection using
  // replaceTrack (no renegotiation needed) instead of the deprecated
  // addStream API. Used for mute/unmute and starting/stopping screen share.
  const applyLocalStream = (newStream) => {
    const oldStream = localStreamRef.current;
    localStreamRef.current = newStream;
    if (localVideoRef.current) localVideoRef.current.srcObject = newStream;

    Object.values(connectionsRef.current).forEach((pc) => {
      const senders = pc.getSenders();
      newStream.getTracks().forEach((track) => {
        const sender = senders.find((s) => s.track && s.track.kind === track.kind);
        if (sender) sender.replaceTrack(track);
        else pc.addTrack(track, newStream);
      });
    });

    if (oldStream) oldStream.getTracks().forEach((track) => track.stop());
  };

  const updateOutgoingMedia = async () => {
    if (!video && !audio) {
      applyLocalStream(createBlackSilence());
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video && videoAvailable,
        audio: audio && audioAvailable,
      });
      applyLocalStream(stream);
    } catch {
      setMediaError("Couldn't update your camera or microphone.");
    }
  };

  useEffect(() => {
    if (askForUsername) return;
    updateOutgoingMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video, audio]);

  useEffect(() => {
    if (askForUsername) return;
    if (screen) startScreenShare();
    else updateOutgoingMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const startScreenShare = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      applyLocalStream(displayStream);
      displayStream.getVideoTracks()[0].onended = () => setScreen(false);
    } catch {
      setScreen(false);
    }
  };

  const createPeerConnection = (peerId) => {
    const pc = new RTCPeerConnection(peerConfigConnections);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("signal", peerId, JSON.stringify({ ice: event.candidate }));
      }
    };

    // Modern replacement for the deprecated onaddstream API.
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      setVideos((prev) => {
        const exists = prev.find((v) => v.socketId === peerId);
        return exists
          ? prev.map((v) => (v.socketId === peerId ? { ...v, stream } : v))
          : [...prev, { socketId: peerId, stream }];
      });
    };

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    connectionsRef.current[peerId] = pc;
    return pc;
  };

  const handleUserJoined = (id, clients) => {
    const isMe = id === socketIdRef.current;

    (clients || []).forEach((peerId) => {
      if (peerId === socketIdRef.current) return;
      if (connectionsRef.current[peerId]) return; // already connected — don't tear it down
      createPeerConnection(peerId);
    });

    if (isMe) {
      // I'm the one who just joined — I initiate offers to everyone already in the room.
      Object.entries(connectionsRef.current).forEach(([peerId, pc]) => {
        pc.createOffer()
          .then((description) => pc.setLocalDescription(description))
          .then(() => {
            socketRef.current.emit("signal", peerId, JSON.stringify({ sdp: pc.localDescription }));
          })
          .catch((e) => console.error("Failed to create offer:", e));
      });
    }
  };

  const handleUserLeft = (id) => {
    if (connectionsRef.current[id]) {
      connectionsRef.current[id].close();
      delete connectionsRef.current[id];
    }
    setVideos((prev) => prev.filter((v) => v.socketId !== id));
  };

  const handleSignal = (fromId, message) => {
    if (fromId === socketIdRef.current) return;

    let signal;
    try {
      signal = JSON.parse(message);
    } catch {
      return;
    }

    const pc = connectionsRef.current[fromId];
    if (!pc) return;

    if (signal.sdp) {
      pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
        .then(() => {
          if (signal.sdp.type === "offer") {
            return pc
              .createAnswer()
              .then((description) => pc.setLocalDescription(description))
              .then(() => {
                socketRef.current.emit("signal", fromId, JSON.stringify({ sdp: pc.localDescription }));
              });
          }
        })
        .catch((e) => console.error("Failed to handle SDP signal:", e));
    }

    if (signal.ice) {
      pc.addIceCandidate(new RTCIceCandidate(signal.ice)).catch((e) =>
        console.error("Failed to add ICE candidate:", e)
      );
    }
  };

  const addMessage = (data, sender, socketIdSender) => {
    setMessages((prev) => [...prev, { sender, data }]);
    if (socketIdSender !== socketIdRef.current && !showChatRef.current) {
      setUnreadCount((prev) => prev + 1);
    }
  };

  const connectToSocketServer = () => {
    socketRef.current = io.connect(server_url);

    socketRef.current.on("signal", handleSignal);

    socketRef.current.on("connect", () => {
      socketIdRef.current = socketRef.current.id;
      setConnecting(false);
      socketRef.current.emit("join-call", meetingCode);

      socketRef.current.on("chat-message", addMessage);
      socketRef.current.on("user-left", handleUserLeft);
      socketRef.current.on("user-joined", handleUserJoined);
    });

    socketRef.current.on("connect_error", () => {
      setConnecting(false);
      setJoinError("Couldn't connect to the meeting server. Please check your connection and try again.");
      setAskForUsername(true);
    });
  };

  const connect = () => {
    if (!username.trim()) {
      setJoinError("Please enter your name.");
      return;
    }
    if (!meetingCode) {
      setJoinError("This meeting link looks invalid. Please enter a valid meeting code.");
      return;
    }
    setJoinError("");
    setConnecting(true);
    setAskForUsername(false);
    connectToSocketServer();
  };

  const cleanupCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    Object.values(connectionsRef.current).forEach((pc) => pc.close());
    connectionsRef.current = {};
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const handleEndCall = () => {
    cleanupCall();
    navigate(localStorage.getItem("token") ? "/home" : "/");
  };

  const openChat = () => {
    setShowChat(true);
    setUnreadCount(0);
  };
  const closeChat = () => setShowChat(false);
  const toggleChat = () => (showChat ? closeChat() : openChat());

  const sendMessage = () => {
    if (!message.trim() || !socketRef.current) return;
    socketRef.current.emit("chat-message", message.trim(), username);
    setMessage("");
  };

  const handleChatKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {askForUsername ? (
        <div className={styles.lobbyContainer}>
          <div className={styles.lobbyCard}>
            <div className={styles.lobbyForm}>
              <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
                Ready to join?
              </Typography>

              {needsManualCode && (
                <TextField
                  id="lobby-meeting-code"
                  label="Meeting Code"
                  value={meetingCodeInput}
                  onChange={(e) => { setMeetingCodeInput(e.target.value); setJoinError(""); }}
                  fullWidth
                  autoFocus
                />
              )}

              <TextField
                id="lobby-username"
                label="Your name"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setJoinError(""); }}
                onKeyDown={(e) => e.key === "Enter" && connect()}
                fullWidth
                autoFocus={!needsManualCode}
              />

              {joinError && <Alert severity="error">{joinError}</Alert>}
              {mediaError && <Alert severity="warning">{mediaError}</Alert>}

              <Button
                variant="contained"
                size="large"
                onClick={connect}
                disabled={connecting}
                startIcon={connecting ? <CircularProgress size={18} color="inherit" /> : null}
              >
                {connecting ? "Connecting…" : "Join Meeting"}
              </Button>
            </div>

            <div className={styles.lobbyPreview}>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={styles.lobbyPreviewVideo}
              />
              <Typography variant="body2" color="text.secondary">
                {videoAvailable || audioAvailable
                  ? "This is how you'll appear to others."
                  : "Camera & microphone are unavailable — you can still join."}
              </Typography>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.meetVideoContainer}>
          {showChat && (
            <div className={styles.chatRoom}>
              <div className={styles.chatHeader}>
                <Typography variant="h6" component="h3">Chat</Typography>
                <IconButton onClick={closeChat} aria-label="Close chat" size="small">
                  <CloseIcon fontSize="small" />
                </IconButton>
              </div>

              <div className={styles.chattingDisplay}>
                {messages.length === 0 ? (
                  <div className={styles.chatEmptyState}>No messages yet. Say hello!</div>
                ) : (
                  messages.map((item, index) => (
                    <div
                      key={index}
                      className={`${styles.chatBubble} ${item.sender === username ? styles.chatBubbleMine : ""}`}
                    >
                      <div className={styles.chatSender}>{item.sender}</div>
                      <div>{item.data}</div>
                    </div>
                  ))
                )}
              </div>

              <div className={styles.chattingArea}>
                <TextField
                  id="chat-message-input"
                  size="small"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  label="Type a message"
                  autoComplete="off"
                />
                <IconButton onClick={sendMessage} aria-label="Send message" color="primary">
                  <SendIcon />
                </IconButton>
              </div>
            </div>
          )}

          <div className={styles.videoGrid}>
            {videos.length === 0 && (
              <div className={styles.emptyGridState}>
                <Typography variant="body1">You&apos;re the only one here right now.</Typography>
                <Typography variant="body2">Share this meeting code to invite others:</Typography>
                <span className={styles.code}>{meetingCode}</span>
              </div>
            )}
            {videos.map((v) => (
              <div key={v.socketId} className={styles.videoTile}>
                <video
                  autoPlay
                  playsInline
                  ref={(ref) => {
                    if (ref && v.stream && ref.srcObject !== v.stream) ref.srcObject = v.stream;
                  }}
                />
                <span className={styles.videoTileLabel}>Participant</span>
              </div>
            ))}
          </div>

          <video className={styles.meetUserVideo} ref={localVideoRef} autoPlay muted playsInline />

          <div className={styles.controlBar}>
            <IconButton
              className={`${styles.controlButton} ${!audio ? styles.controlButtonActive : ""}`}
              onClick={() => setAudio((a) => !a)}
              aria-label={audio ? "Mute microphone" : "Unmute microphone"}
            >
              {audio ? <MicIcon /> : <MicOffIcon />}
            </IconButton>

            <IconButton
              className={`${styles.controlButton} ${!video ? styles.controlButtonActive : ""}`}
              onClick={() => setVideo((v) => !v)}
              aria-label={video ? "Turn camera off" : "Turn camera on"}
            >
              {video ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>

            {screenAvailable && (
              <IconButton
                className={`${styles.controlButton} ${screen ? styles.controlButtonActive : ""}`}
                onClick={() => setScreen((s) => !s)}
                aria-label={screen ? "Stop screen sharing" : "Share your screen"}
              >
                {screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
              </IconButton>
            )}

            <Badge badgeContent={unreadCount} max={99} color="primary" invisible={unreadCount === 0}>
              <IconButton
                className={styles.controlButton}
                onClick={toggleChat}
                aria-label={showChat ? "Close chat" : "Open chat"}
              >
                <ChatIcon />
              </IconButton>
            </Badge>

            <Tooltip title="Leave call">
              <IconButton className={styles.endCallButton} onClick={handleEndCall} aria-label="Leave call">
                <CallEndIcon />
              </IconButton>
            </Tooltip>
          </div>
        </div>
      )}

      <Snackbar
        open={Boolean(mediaError) && !askForUsername}
        autoHideDuration={6000}
        onClose={() => setMediaError("")}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity="warning" onClose={() => setMediaError("")}>
          {mediaError}
        </Alert>
      </Snackbar>
    </>
  );
}
