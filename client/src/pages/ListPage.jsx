import React, { useState, useCallback, useMemo } from "react";
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

/* ---------- dummy feed (has `interested`) ---------- */
const DUMMY_FEED = [
  {
    id: "pin_1",
    type: "pin",
    tag: "Potluck",
    distance: "2 mi",
    timeLabel: "In 8 days",
    text: "Hosting a potluck at the park! Come bring your family and friends!",
    images: [
      "https://picsum.photos/seed/pot1/400/260",
      "https://picsum.photos/seed/pot2/400/260",
    ],
    author: "Chicken__Man",
    comments: 8,
    interested: ["anna", "ben", "cory", "dee", "emma", "finn", "gia", "hank", "ivy", "bob", "stan"],
  },
  {
    id: "disc_1",
    type: "discussion",
    tag: "Superman Premiere",
    distance: "10 mi",
    timeLabel: "1 Days Left",
    text: "How did everyone feel about the new superman?",
    images: ["https://picsum.photos/seed/super/400/260"],
    author: "MovieBuff",
    comments: 2,
    interested: ["sam", "tess", "uma"],
  },
  {
    id: "pin_2",
    type: "pin",
    tag: "Community Clean-up",
    distance: "2.4 mi",
    timeLabel: "In 3 hours",
    text: "Join us to spruce up the lake trail. Gloves and bags provided.",
    images: [],
    author: "TrailCrew",
    comments: 3,
    interested: ["zoe", "yuki", "xav", "will", "val"],
  },
];

/* ---------- helpers ---------- */
function milesFrom(dist = "") {
  const n = parseFloat(String(dist).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}
function hoursUntil(label = "") {
  const s = String(label).toLowerCase().trim();
  const hm = s.match(/in\s*(\d+(?:\.\d+)?)\s*hour|(\d+(?:\.\d+)?)\s*hour/);
  if (hm) return parseFloat(hm[1] ?? hm[2]) || 0;
  const dm = s.match(/in\s*(\d+(?:\.\d+)?)\s*day|(\d+(?:\.\d+)?)\s*day/);
  if (dm) return (parseFloat(dm[1] ?? dm[2]) || 0) * 24;
  const dl = s.match(/(\d+(?:\.\d+)?)\s*days?\s*left/);
  if (dl) return (parseFloat(dl[1]) || 0) * 24;
  if (/\btomorrow\b/.test(s)) return 24;
  if (/\btoday\b/.test(s) || /\b0\s*days?\b/.test(s)) return 1;
  return 999999;
}
function formatTimeLabel(label = "") {
  const s = String(label).toLowerCase().trim();
  const h = s.match(/(\d+(?:\.\d+)?)\s*hour/);
  if (h) {
    const n = Math.round(parseFloat(h[1]));
    return `In ${n} hour${n === 1 ? "" : "s"}`;
  }
  if (/\btoday\b/.test(s) || /\b0\s*days?\b/.test(s)) return "In a few hours";
  const d1 = s.match(/in\s*(\d+(?:\.\d+)?)\s*days?/);
  const d2 = s.match(/(\d+(?:\.\d+)?)\s*days?\s*left/);
  const num = d1 ? parseFloat(d1[1]) : d2 ? parseFloat(d2[1]) : null;
  if (Number.isFinite(num)) {
    const n = Math.round(num);
    return n === 1 ? "In 1 day" : `In ${n} days`;
  }
  if (/\btomorrow\b/.test(s)) return "In 1 day";
  return label;
}

/* ---------- Interested bubbles ---------- */
const InterestedRow = ({ users = [] }) => {
  const MAX = 8;
  const visible = users.slice(0, MAX);
  const extra = users.length - visible.length;

  return (
    <div className="interested-row" aria-label="Interested users">
      {visible.map((u, i) => (
        <div className="interest-bubble" key={i} title={`@${u}`} />
      ))}
      {extra > 0 && <span className="interest-more">+{extra}</span>}
    </div>
  );
};

function ListPage() {
  const [sortByExpiration, setSortByExpiration] = useState(false); // false = distance, true = expiration
  const handleToggle = useCallback(() => setSortByExpiration(v => !v), []);
  const onToggleKeyDown = useCallback((e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSortByExpiration(v => !v);
    }
  }, []);

  const sortedFeed = useMemo(() => {
    const items = [...DUMMY_FEED];
    if (sortByExpiration) {
      items.sort((a, b) => {
        const ha = hoursUntil(a.timeLabel);
        const hb = hoursUntil(b.timeLabel);
        if (ha !== hb) return ha - hb;
        return milesFrom(a.distance) - milesFrom(b.distance);
      });
    } else {
      items.sort((a, b) => milesFrom(a.distance) - milesFrom(b.distance));
    }
    return items;
  }, [sortByExpiration]);

  return (
    <div className="list-page">
      <div className="list-frame">
        {/* Header */}
        <header className="header-bar">
          <button className="header-icon-btn" aria-label="Menu">
            <img src={menuIcon} alt="Menu" className="header-icon" />
          </button>
          <h1 className="header-title">List</h1>
          <button className="header-icon-btn" aria-label="Notifications">
            <img src={updatesIcon} alt="Notifications" className="header-icon" />
          </button>
        </header>

        {/* Topbar */}
        <div className="topbar">
          <div className="top-left">
            <button className="icon-btn" type="button" aria-label="Settings">
              <img src={settingsIcon} alt="Settings" />
            </button>

            <div
              className={`toggle-container ${sortByExpiration ? "active" : ""}`}
              role="switch"
              aria-checked={sortByExpiration}
              tabIndex={0}
              onClick={handleToggle}
              onKeyDown={onToggleKeyDown}
              title="Toggle sort"
            >
              <div className="toggle-circle" />
            </div>

            <div className="sort-row">
              <span className="sort-label">Sort by:</span>
              <button className="sort-link" type="button" onClick={handleToggle}>
                {sortByExpiration ? "Expiration" : "Distance"}
              </button>
            </div>
          </div>

          <button className="add-btn" type="button" aria-label="Add">
            <img src={addIcon} alt="Add" />
          </button>
        </div>

        {/* Feed */}
        <div className="feed">
          {sortedFeed.map((item) => {
            const interested = item.interested ?? [];
            const attendanceCount = interested.length;
            return (
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
                    <span className="time">{formatTimeLabel(item.timeLabel)}</span>
                    <span className="dot">·</span>
                    <span className="dist">{item.distance}</span>
                  </div>
                </header>

                <div className="card-body">
                  <p className="card-text">{item.text}</p>
                  {item.images?.length > 0 && (
                    <div className={`media-grid ${item.images.length > 1 ? "two" : "one"}`}>
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

                  {/* interested users trail (matches attendanceCount) */}
                  <InterestedRow users={interested} />

                  <div className="counts">
                    {/* Comments count */}
                    <span title="Comments" className="count-item">
                      <img src={commentsIcon} alt="Comments" className="count-icon" /> {item.comments}
                    </span>
                    {/* Attendance count (live from interested users) */}
                    <span title="Interested / Attending" className="count-item">
                      <img src={attendanceIcon} alt="Attendance" className="count-icon" /> {attendanceCount}
                    </span>
                  </div>
                </footer>
              </article>
            );
          })}
        </div>

        <Navbar />
      </div>
    </div>
  );
}

export default ListPage;