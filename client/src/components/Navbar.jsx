import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./Navbar.css";

// regular icons
import ChatIcon from "../assets/ChatPage.svg";
import MapIcon from "../assets/MapPage.svg";
import ListIcon from "../assets/ListPage.svg";
// filled/selected icons
import ChatFilled from "../assets/chat-filled.svg";
import MapFilled from "../assets/map-filled.svg";
import ListFilled from "../assets/list-filled.svg";
import { useSocialNotificationsContext } from '../contexts/SocialNotificationsContext';

export default function Navbar() {
  const { t } = useTranslation();
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

  const chatLabel = t("nav.bottomNav.chat");
  const mapLabel = t("nav.bottomNav.map");
  const listLabel = t("nav.bottomNav.list");
  const chatAriaLabel = showDmBadge
    ? t("nav.bottomNav.chatAria.badge", { count: dmThreadCount })
    : t("nav.bottomNav.chatAria.default");
  const listAriaLabel = showFriendBadge
    ? t("nav.bottomNav.listAria.badge", { count: friendRequestCount })
    : t("nav.bottomNav.listAria.default");

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
                alt={chatLabel}
                className="nav-icon"
              />
              {showDmBadge ? (
                <span className="nav-item-badge" aria-hidden="true">
                  {formattedDmCount}
                </span>
              ) : null}
              <span>{chatLabel}</span>
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
                alt={mapLabel}
                className="nav-icon"
              />
              <span>{mapLabel}</span>
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
                alt={listLabel}
                className="nav-icon"
              />
              {showFriendBadge ? (
                <span className="nav-item-badge" aria-hidden="true">
                  {formattedFriendCount}
                </span>
              ) : null}
              <span>{listLabel}</span>
            </>
          )}
        </NavLink>
      </nav>
    </>
  );
}
