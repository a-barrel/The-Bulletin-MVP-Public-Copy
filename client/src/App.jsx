import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import MapPage from './pages/MapPage';
import ListPage from './pages/ListPage';
import PinDetails from './pages/PinDetails';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
      <Route path="/list" element={<ListPage />} />
      <Route path="/pin/:pinId" element={<PinDetails />} />
      <Route path="/" element={<Login />} />
    </Routes>
  );
}

export default App;
