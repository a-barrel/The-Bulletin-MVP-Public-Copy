import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { auth } from '../firebase';
import { routes } from '../routes';

const ProtectedRoute = ({ children }) => {
  const [user, loading] = useAuthState(auth);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to={routes.auth.login} />;
  }

  return children;
};

export default ProtectedRoute;
