import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography, Box } from '@mui/material';

export default function PageNotFound() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        bgcolor: '#f5f5f5',
        textAlign: 'center',
        px: 3,
      }}
    >
      <Typography
        variant="h1"
        sx={{
          fontSize: { xs: '6rem', sm: '8rem' },
          fontWeight: 'bold',
          color: 'primary.main',
        }}
      >
        404
      </Typography>

      <Typography
        variant="h4"
        sx={{
          mt: 2,
          mb: 1,
          fontWeight: 500,
          color: '#333',
        }}
      >
        Page Not Found
      </Typography>

      <Typography
        variant="body1"
        sx={{
          mb: 4,
          color: '#555',
        }}
      >
        The page you are looking for does not exist.
      </Typography>

      <Button
        variant="contained"
        color="primary"
        sx={{
          px: 4,
          py: 1.5,
          fontSize: '1rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          '&:hover': {
            boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
          },
        }}
        onClick={() => navigate('/')}
      >
        Go to Home
      </Button>
    </Box>
  );
}
