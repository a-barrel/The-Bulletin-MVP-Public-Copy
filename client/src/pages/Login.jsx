import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoginIcon from '@mui/icons-material/Login';
import GTranslateIcon from '@mui/icons-material/GTranslate';

const persistAuthToken = async () => {
  const user = auth.currentUser;
  if (!user) {
    return;
  }

  const token = await user.getIdToken();
  if (token && typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('pinpointAuthToken', token);
  }
};

export const pageConfig = {
  id: 'login',
  label: 'Login',
  icon: LoginIcon,
  path: '/login',
  aliases: ['/'],
  order: 0,
  showInNav: true,
  isDefault: true
};

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      await persistAuthToken();
      navigate('/map');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      await persistAuthToken();
      navigate('/map');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      component="section"
      sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 3
      }}
    >
      <Box
        component="form"
        onSubmit={handleLogin}
        sx={{
          width: '100%',
          maxWidth: 360,
          backgroundColor: 'background.paper',
          p: 4,
          borderRadius: 2,
          boxShadow: 12
        }}
      >
        <Stack spacing={3}>
          <Box>
            <Typography variant="h5" gutterBottom>
              Welcome back
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in to continue exploring nearby pins.
            </Typography>
          </Box>

          <TextField
            type="email"
            label="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            fullWidth
            autoComplete="email"
          />

          <TextField
            type="password"
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            fullWidth
            autoComplete="current-password"
          />

          <Button
            type="submit"
            variant="contained"
            color="primary"
            size="large"
            startIcon={<LoginIcon />}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </Button>

          <Button
            type="button"
            variant="outlined"
            color="secondary"
            startIcon={<GTranslateIcon />}
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
          >
            Sign in with Google
          </Button>

          {error && (
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

export default LoginPage;
