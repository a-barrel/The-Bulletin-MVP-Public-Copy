import { NavLink } from "react-router-dom";
import "./Navbar.css";

// regular icons
import ChatIcon from "../assets/ChatPage.svg";
import MapIcon from "../assets/MapPage.svg";
import ListIcon from "../assets/ListPage.svg";
// filled/selected icons
import ChatFilled from "../assets/chat-filled.svg";
import MapFilled from "../assets/map-filled.svg";
import ListFilled from "../assets/list-filled.svg";
import { routes } from "../routes";

export default function Navbar() {
  return (
    <>
      <div className="bottom-nav-spacer" aria-hidden="true" />
      <nav className="bottom-nav">
        <NavLink
          to="/chat"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          {({ isActive }) => (
            <>
              <img
                src={isActive ? ChatFilled : ChatIcon}
                alt="Chat"
                className="nav-icon"
              />
              <span>Chat</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/map"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          {({ isActive }) => (
            <>
              <img
                src={isActive ? MapFilled : MapIcon}
                alt="Map"
                className="nav-icon"
              />
              <span>Map</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/list"
          end
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          {({ isActive }) => (
            <>
              <img
                src={isActive ? ListFilled : ListIcon}
                alt="List"
                className="nav-icon"
              />
              <span>List</span>
            </>
          )}
        </NavLink>
      </nav>
    </>
  );
}
