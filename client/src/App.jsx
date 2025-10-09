import { Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import MapPage from './pages/MapPage';
import ListPage from './pages/ListPage';
import PinDetails from './pages/PinDetails';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
      <Route path="/list" element={<ListPage />} />
      <Route path="/pin/:pinId" element={<PinDetails />} />
      <Route path="/" element={<LoginPage />} />
    </Routes>
  );
}

export default App;
