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
import { useSocialNotificationsContext } from '../contexts/SocialNotificationsContext';

export default function Navbar() {
  const {
    friendRequestCount,
    dmThreadCount,
    friendAccessDenied,
    dmAccessDenied
  } = useSocialNotificationsContext();

  const showDmBadge = !dmAccessDenied && dmThreadCount > 0;
  const showFriendBadge = !friendAccessDenied && friendRequestCount > 0;

  const formattedDmCount = showDmBadge ? (dmThreadCount > 99 ? '99+' : String(dmThreadCount)) : null;
  const formattedFriendCount = showFriendBadge ? (friendRequestCount > 99 ? '99+' : String(friendRequestCount)) : null;

  const chatAriaLabel = showDmBadge
    ? `Chat (${dmThreadCount} direct message ${dmThreadCount === 1 ? 'thread' : 'threads'})`
    : 'Chat';
  const listAriaLabel = showFriendBadge
    ? `List (${friendRequestCount} friend request${friendRequestCount === 1 ? '' : 's'})`
    : 'List';

  return (
    <>
      <div className="bottom-nav-spacer" aria-hidden="true" />
      <nav className="bottom-nav">
        <NavLink
          to="/chat"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          aria-label={chatAriaLabel}
        >
          {({ isActive }) => (
            <>
              <img
                src={isActive ? ChatFilled : ChatIcon}
                alt="Chat"
                className="nav-icon"
              />
              {showDmBadge ? (
                <span className="nav-item-badge" aria-hidden="true">
                  {formattedDmCount}
                </span>
              ) : null}
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
          aria-label={listAriaLabel}
        >
          {({ isActive }) => (
            <>
              <img
                src={isActive ? ListFilled : ListIcon}
                alt="List"
                className="nav-icon"
              />
              {showFriendBadge ? (
                <span className="nav-item-badge" aria-hidden="true">
                  {formattedFriendCount}
                </span>
              ) : null}
              <span>List</span>
            </>
          )}
        </NavLink>
      </nav>
    </>
  );
}
