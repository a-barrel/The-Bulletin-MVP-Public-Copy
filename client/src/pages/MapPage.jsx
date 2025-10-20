import { useState, useEffect, useCallback } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import MapIcon from '@mui/icons-material/Map';
import Map from '../components/Map';
import LocationShare from '../components/LocationShare';
import { fetchPinsNearby } from '../api/mongoDataApi.js'; // Make sure to import fetchPinsNearby
import "./ListPage.css";
import commentsIcon from "../assets/Comments.png";
import attendanceIcon from "../assets/AttendanceIcon.png";
import Navbar from "../components/Navbar";
import pinIcon from "../assets/PinIcon.png";
import discussionIcon from "../assets/DiscussionIcon.png";
import settingsIcon from "../assets/GearIcon.svg";
import addIcon from "../assets/AddIcon.svg";
import menuIcon from "../assets/MenuIcon.svg";
import updatesIcon from "../assets/UpdateIcon.svg";

export const pageConfig = {
  id: 'map',
  label: 'Map',
  icon: MapIcon,
  path: '/map',
  order: 1,
  protected: true,
  showInNav: true
};

const DEFAULT_MAX_DISTANCE_METERS = 16093; // ~10 miles
const FALLBACK_LOCATION = { latitude: 33.7838, longitude: -118.1136 };

function MapPage() {
  const [toggleOn, setToggleOn] = useState(false);
  const handleToggle = useCallback(() => setToggleOn(v => !v), []);
  const onToggleKeyDown = useCallback((e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setToggleOn(v => !v);
    }
  }, []);

  // --- New State Variables ---
  const [userLocation, setUserLocation] = useState(null);
  const [pins, setPins] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- New useEffect to get user's location ---
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLoading(false);
        },
        (err) => {
          console.error("Error getting location:", err);
          setUserLocation(FALLBACK_LOCATION);
          setError("Could not get your location, using a fallback.");
          setLoading(false);
        }
      );
    } else {
      setUserLocation(FALLBACK_LOCATION);
      setError("Geolocation is not supported by this browser.");
      setLoading(false);
    }
  }, []);

  // --- New useEffect to fetch pins when location is available ---
  useEffect(() => {
    if (userLocation) {
      setLoading(true);
      fetchPinsNearby({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        distanceMiles: 10 // You can adjust this distance
      })
        .then(fetchedPins => {
          setPins(fetchedPins);
          setLoading(false);
        })
        .catch(err => {
          console.error("Error fetching nearby pins:", err);
          setError("Could not fetch nearby pins.");
          setLoading(false);
        });
    }
  }, [userLocation]);

  return (
    <div className="list-page">
      <div className="list-frame">
        {/* 🔹 Top Header Bar */}
        <header className="header-bar">
          <button className="header-icon-btn" aria-label="Menu">
            <img src={menuIcon} alt="Menu" className="header-icon" />
          </button>
          <h1 className="header-title">Map</h1>
          <button className="header-icon-btn" aria-label="Notifications">
            <img src={updatesIcon} alt="Notifications" className="header-icon" />
          </button>
        </header>

        {/* Topbar (Settings, Toggle, Sort, Add) */}
        <div className="topbar">
          <div className="top-left">
            <button className="icon-btn" type="button" aria-label="Settings">
              <img src={settingsIcon} alt="Settings" />
            </button>
          </div>
          <button className="add-btn" type="button" aria-label="Add">
            <img src={addIcon} alt="Add" />
          </button>
        </div>

        {/* 🔹 Map Component */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {error && <Alert severity="error">{error}</Alert>}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress />
            </Box>
          ) : (
            <Map
              userLocation={userLocation}
              pins={pins}
            />
          )}
        </div>

        <Navbar />
      </div>
    </div>
  );
}

export default MapPage;