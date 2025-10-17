// App.jsx
import { Routes, Route, Navigate, Outlet } from "react-router-dom";

import ListPage from "./pages/ListPage";
import PinDetails from "./pages/PinDetails";
import ProtectedRoute from "./components/ProtectedRoute";
import RegistrationPage from "./pages/Registration";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import MapPage from "./pages/MapPage";
// NOTE: Navbar is NOT imported here on purpose

// Layout used for routes that should NOT inject a global navbar
function AppNavLayout() {
  return <Outlet />; // just render the child page
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

      {/* Pages that manage their own navbar (ListPage, MapPage, etc.) */}
      <Route element={<AppNavLayout />}>
        <Route
          path="/map"
          element={
            <ProtectedRoute>
              <MapPage /> {/* MapPage can include <Navbar /> if you want it */}
            </ProtectedRoute>
          }
        />
        <Route path="/list" element={<ListPage />} /> {/* ListPage includes <Navbar /> */}
      </Route>
    </Routes>
  );
}