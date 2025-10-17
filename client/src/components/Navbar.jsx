import { NavLink } from "react-router-dom";
import "./Navbar.css";
import ChatIcon from "../assets/ChatPage.svg";
import MapIcon from "../assets/MapPage.svg";
import ListIcon from "../assets/ListPage.svg"; // ✅ matches your files

export default function Navbar() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/chat" className="nav-item">
        <img src={ChatIcon} alt="Chat" className="nav-icon" />
        <span>Chat</span>
      </NavLink>
      <NavLink to="/map" className="nav-item">
        <img src={MapIcon} alt="Map" className="nav-icon" />
        <span>Map</span>
      </NavLink>
      <NavLink to="/list" className="nav-item">
        <img src={ListIcon} alt="List" className="nav-icon" />
        <span>List</span>
      </NavLink>
    </nav>
  );
}