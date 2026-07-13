import * as React from "react";
import {
  Avatar,
  Button,
  TextField,
  Paper,
  Box,
  Grid,
  Snackbar,
  Alert,
  Typography,
  CircularProgress,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { AuthContext } from "../contexts/authContextObject";

export default function Authentication() {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [formState, setFormState] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const { handleRegister, handleLogin } = React.useContext(AuthContext);

  const isLogin = formState === 0;
  const canSubmit = isLogin
    ? username.trim() && password
    : name.trim() && username.trim() && password;

  const handleAuth = async () => {
    if (!canSubmit || submitting) return;
    setError("");
    setSubmitting(true);

    try {
      if (isLogin) {
        await handleLogin(username, password);
      } else {
        const result = await handleRegister(name, username, password);
        setMessage(result);
        setOpen(true);
        setFormState(0);
        setUsername("");
        setPassword("");
        setName("");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAuth();
    }
  };

  return (
    <>
      <Grid container component="main" sx={{ height: "100vh" }}>
        <Grid
          item
          xs={false}
          sm={4}
          md={7}
          sx={{
            height: "100vh",
            backgroundImage:
              'url("https://images.unsplash.com/photo-1581091870627-9b50c2f6efc7?auto=format&fit=crop&w=1920&q=80")',
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <Grid item xs={12} sm={8} md={5} component={Paper} elevation={6} square>
          <Box
            sx={{
              my: 8,
              mx: "auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              maxWidth: 400,
              px: 2,
            }}
          >
            <Avatar sx={{ m: 1, bgcolor: "primary.main" }}>
              <LockOutlinedIcon />
            </Avatar>

            <Typography component="h1" variant="h5" sx={{ fontWeight: 600 }}>
              {isLogin ? "Welcome back" : "Create your account"}
            </Typography>

            <Box sx={{ display: "flex", gap: 2, mt: 3 }}>
              <Button
                variant={formState === 0 ? "contained" : "outlined"}
                onClick={() => { setFormState(0); setError(""); }}
              >
                Sign In
              </Button>
              <Button
                variant={formState === 1 ? "contained" : "outlined"}
                onClick={() => { setFormState(1); setError(""); }}
              >
                Sign Up
              </Button>
            </Box>

            <Box component="form" noValidate sx={{ mt: 2, width: "100%" }} onKeyDown={handleKeyDown}>
              {formState === 1 && (
                <TextField
                  id="auth-name"
                  margin="normal"
                  required
                  fullWidth
                  label="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              )}

              <TextField
                id="auth-username"
                margin="normal"
                required
                fullWidth
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <TextField
                id="auth-password"
                margin="normal"
                required
                fullWidth
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {error}
                </Alert>
              )}

              <Button
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                onClick={handleAuth}
                disabled={!canSubmit || submitting}
                startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
              >
                {submitting ? "Please wait…" : isLogin ? "Login" : "Register"}
              </Button>
            </Box>
          </Box>
        </Grid>
      </Grid>

      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={() => setOpen(false)}
        message={message}
      />
    </>
  );
}
