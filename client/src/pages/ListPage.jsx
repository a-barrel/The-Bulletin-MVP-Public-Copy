import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./ListPage.css";
import PlaceIcon from '@mui/icons-material/Place'; // TODO: used only for Icon on pageConfig, maybe change with a list icon?
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
  id: 'list',      // id
  label: 'List',   // Label (used in debug nav.)
  icon: PlaceIcon, // TODO: maybe change with a list icon? Don't forget the import!
  path: '/list',   // Path
  order: 4,        // Where in debug nav it is ordered
  showInNav: true, // Shows in Debug Navigator(?)
  protected: true, // Checks if user is logged in
};

const DUMMY_FEED = [
  {
    id: "pin_1",
    type: "pin",
    tag: "Potluck",
    distance: "6 mi",
    timeLabel: "In 3 Days",
    text: "Hosting a potluck at the park! Come bring your family and friends!",
    images: [
      "https://picsum.photos/seed/pot1/400/260",
      "https://picsum.photos/seed/pot2/400/260",
    ],
    author: "Chicken__Man",
    comments: 8,
    saves: 2,
  },
  {
    id: "disc_1",
    type: "discussion",
    tag: "Superman Premiere",
    distance: "6 mi",
    timeLabel: "4 Days Left",
    text: "How did everyone feel about the new superman?",
    images: ["https://picsum.photos/seed/super/400/260"],
    author: "MovieBuff",
    comments: 2,
    saves: 0,
  },
  {
    id: "pin_2",
    type: "pin",
    tag: "Community Clean-up",
    distance: "2.4 mi",
    timeLabel: "Tomorrow",
    text: "Join us to spruce up the lake trail. Gloves and bags provided.",
    images: [],
    author: "TrailCrew",
    comments: 3,
    saves: 5,
  },
];

function ListPage() {
  const navigate = useNavigate();
  const [toggleOn, setToggleOn] = useState(false);
  const handleToggle = useCallback(() => setToggleOn(v => !v), []);
  const onToggleKeyDown = useCallback((e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setToggleOn(v => !v);
    }
  }, []);
  const handleNotifications = useCallback(() => {
    navigate('/updates');
  }, [navigate]);

  return (
    <div className="list-page">
      <div className="list-frame">
        {/* 🔹 Top Header Bar */}
        {/* Fixed purple header bar */}
        <header className="header-bar">
          <button className="header-icon-btn" aria-label="Menu">
            <img src={menuIcon} alt="Menu" className="header-icon" />
          </button>

          <h1 className="header-title">List</h1>

          <button
            className="header-icon-btn"
            type="button"
            aria-label="Notifications"
            onClick={handleNotifications}
          >
            <img src={updatesIcon} alt="Notifications" className="header-icon" />
          </button>
        </header>


        {/* Topbar (Settings, Toggle, Sort, Add) */}
        <div className="topbar">
          <div className="top-left">
            <button className="icon-btn" type="button" aria-label="Settings">
              <img src={settingsIcon} alt="Settings" />
            </button>

            {/* Purple toggle */}
            <div
              className={`toggle-container ${toggleOn ? "active" : ""}`}
              role="switch"
              aria-checked={toggleOn}
              tabIndex={0}
              onClick={handleToggle}
              onKeyDown={onToggleKeyDown}
            >
              <div className="toggle-circle" />
            </div>

            <div className="sort-row">
              <span className="sort-label">Sort by:</span>
              <button className="sort-link" type="button">
                Distance
              </button>
            </div>
          </div>

          <button className="add-btn" type="button" aria-label="Add">
            <img src={addIcon} alt="Add" />
          </button>
        </div>

        {/* Feed */}
        <div className="feed">
          {DUMMY_FEED.map((item) => (
            <article className={`card ${item.type}`} key={item.id}>
              <header className={`card-header ${item.type}`}>
                <div className="tag">
                  <img
                    src={item.type === "pin" ? pinIcon : discussionIcon}
                    alt={item.type === "pin" ? "Pin" : "Discussion"}
                    className="tag-icon"
                  />
                  <span>{item.tag}</span>
                </div>
                <div className="meta-right">
                  <span className="time">{item.timeLabel}</span>
                  <span className="dot">&bull;</span>
                  <span className="dist">{item.distance}</span>
                </div>
              </header>

              <div className="card-body">
                <p className="card-text">{item.text}</p>

                {item.images?.length > 0 && (
                  <div
                    className={`media-grid ${
                      item.images.length > 1 ? "two" : "one"
                    }`}
                  >
                    {item.images.map((src, i) => (
                      <img className="media" src={src} alt="" key={i} />
                    ))}
                  </div>
                )}
              </div>

              <footer className="card-footer">
                <div className="author">
                  <div className="avatar" aria-hidden="true" />
                  <span className="name">@{item.author}</span>
                </div>
                <div className="counts">
                  <span title="Comments" className="count-item">
                    <img
                      src={commentsIcon}
                      alt="Comments"
                      className="count-icon"
                    />{" "}
                    {item.saves}
                  </span>
                  <span title="Attendance" className="count-item">
                    <img
                      src={attendanceIcon}
                      alt="Attendance"
                      className="count-icon"
                    />{" "}
                    {item.comments}
                  </span>
                </div>
              </footer>
            </article>
          ))}
        </div>

        <Navbar />
      </div>
    </div>
  );
}

export default ListPage;

