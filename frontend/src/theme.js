import { createTheme } from "@mui/material/styles";

// Single source of truth for the app's brand colours/typography so every
// page (auth, home, history, video call, 404) looks consistent.
const theme = createTheme({
  palette: {
    primary: {
      main: "#FF9839",
      dark: "#D97500",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#1a1a2e",
    },
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
        },
      },
    },
  },
});

export default theme;
