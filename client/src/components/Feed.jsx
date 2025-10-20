import React from "react";
import { useNavigate } from "react-router-dom";
import commentsIcon from "../assets/Comments.png";
import attendanceIcon from "../assets/AttendanceIcon.png";
import pinIcon from "../assets/PinIcon.png";
import discussionIcon from "../assets/DiscussionIcon.png";
import "./Feed.css";

/* ---------- small helpers (display only) ---------- */
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

/* ---------- Interested bubbles (inline here for simplicity) ---------- */
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

/* ---------- Feed component ---------- */
export default function Feed({ items = [] }) {
  const navigate = useNavigate();

  const handleAuthorClick = (e, item) => {
    e.stopPropagation();
    if (item.creatorId || item.creator?._id) {
      const authorId = item.creatorId || item.creator._id;
      navigate(`/user/${authorId}`);
    }
  };

  return (
    <div className="feed">
      {items.map((item) => {
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
                <span 
                  className="name author-clickable"
                  onClick={(e) => handleAuthorClick(e, item)}
                >
                  @{item.creator?.displayName || item.creator?.username || item.author}
                </span>
              </div>

              {/* interested users trail */}
              <InterestedRow users={interested} />

              <div className="counts">
                <span title="Comments" className="count-item">
                  <img src={commentsIcon} alt="Comments" className="count-icon" /> {item.comments}
                </span>
                <span title="Interested / Attending" className="count-item">
                  <img src={attendanceIcon} alt="Attendance" className="count-icon" /> {attendanceCount}
                </span>
              </div>
            </footer>
          </article>
        );
      })}
    </div>
  );
}