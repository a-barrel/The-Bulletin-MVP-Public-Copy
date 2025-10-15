import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';

import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import MapPage from './pages/MapPage';
import ListPage from './pages/ListPage';
import PinDetails from './pages/PinDetails';
import ProtectedRoute from './components/ProtectedRoute';
import RegistrationPage from './pages/Registration';
// import ChatPage from './pages/ChatPage'; // when you have it

// Layout that shows the bottom navbar only for certain pages
function AppNavLayout() {
  return (
    <>
      <Outlet />           {/* renders the child route's page */}
      <Navbar />           {/* fixed bottom nav */}
    </>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Auth / misc (no navbar) */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegistrationPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/pin/:pinId" element={<PinDetails />} />
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Pages with navbar */}
      <Route element={<AppNavLayout />}>
        {/* <Route path="/chat" element={<ChatPage />} /> */}
        <Route
          path="/map"
          element={
            <ProtectedRoute>
              <MapPage />
            </ProtectedRoute>
          }
        />
        <Route path="/list" element={<ListPage />} />
      </Route>
    </Routes>
  );
}