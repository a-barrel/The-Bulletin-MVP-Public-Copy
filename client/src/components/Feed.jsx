import React from "react";
import "./Feed.css";

const DEFAULT_AVATAR = "/images/profile/profile-01.jpg";

const resolveAuthorName = (item) =>
  item?.authorName ||
  item?.author ||
  item?.creator?.displayName ||
  item?.creator?.username ||
  "Unknown";

const resolveAvatar = (item) =>
  item?.creator?.avatar?.url ||
  item?.creator?.avatar?.thumbnailUrl ||
  item?.avatar ||
  DEFAULT_AVATAR;

const interestInitial = (value) => {
  const label = typeof value === "string" ? value.trim() : "";
  if (!label) return "?";
  return label.charAt(0).toUpperCase();
};

const resolveTagBadge = (type) => {
  switch (type) {
    case "pin":
      return "PIN";
    case "discussion":
      return "CHAT";
    default:
      return "ITEM";
  }
};

function FeedCard({ item }) {
  const cardType = item?.type ? String(item.type).toLowerCase() : "";
  const images = Array.isArray(item?.images) ? item.images.filter(Boolean) : [];
  const interested = Array.isArray(item?.interested)
    ? item.interested.filter(Boolean)
    : [];
  const displayedInterested = interested.slice(0, 5);
  const remainingInterested =
    interested.length > displayedInterested.length
      ? interested.length - displayedInterested.length
      : 0;
  const authorName = resolveAuthorName(item);
  const baseKey = item?.id || item?._id || authorName || "item";
  const tagBadge = resolveTagBadge(cardType);

  return (
    <article className={`card ${cardType}`}>
      <header className={`card-header ${cardType}`}>
        <div className="tag">
          <span className="tag-icon" aria-hidden="true">
            {tagBadge}
          </span>
          <span>{item?.tag || "Untitled"}</span>
        </div>
        <div className="meta-right">
          {item?.distance && <span className="distance">{item.distance}</span>}
          {item?.distance && item?.timeLabel && <span className="dot">|</span>}
          {item?.timeLabel && <span className="time">{item.timeLabel}</span>}
          <button type="button" className="bookmark-btn" aria-label="Bookmark pin">
            <span className="bookmark-emoji" role="img" aria-hidden="true">
              [*]
            </span>
          </button>
        </div>
      </header>

      {item?.text && <p className="card-text">{item.text}</p>}

      {images.length > 0 && (
        <div
          className={`media-grid ${
            images.length === 1 ? "one" : images.length === 2 ? "two" : ""
          }`}
        >
          {images.map((src, imgIndex) => (
            <img
              key={`${baseKey}-media-${imgIndex}`}
              src={src}
              className="media"
              alt=""
              loading="lazy"
            />
          ))}
        </div>
      )}

      <footer className="card-footer">
        <div className="author">
          <img
            className="avatar"
            src={resolveAvatar(item)}
            alt={`${authorName} avatar`}
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = DEFAULT_AVATAR;
            }}
          />
          <span className="name">{authorName}</span>
        </div>

        <div className="interested-row">
          {displayedInterested.map((name, interestIndex) => (
            <span
              className="interest-bubble"
              key={`${baseKey}-interest-${interestIndex}`}
              title={String(name)}
            >
              {interestInitial(name)}
            </span>
          ))}
          {remainingInterested > 0 && (
            <span className="interest-more">+{remainingInterested}</span>
          )}
        </div>

        <div className="counts">
          {typeof item?.comments === "number" && (
            <span className="count-item" title="Comments">
              <span className="count-icon" aria-hidden="true">
                C
              </span>
              <span>{item.comments}</span>
            </span>
          )}

          {interested.length > 0 && (
            <span className="count-item" title="Interested users">
              <span className="count-icon" aria-hidden="true">
                *
              </span>
              <span>{interested.length}</span>
            </span>
          )}
        </div>
      </footer>
    </article>
  );
}

export default function Feed({ items }) {
  if (!Array.isArray(items) || items.length === 0) {
    return (
      <div className="feed">
        <div className="card">
          <p className="card-text">No nearby pins yet. Check back soon!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="feed">
      {items.map((item, index) => (
        <FeedCard
          item={item}
          key={item?.id || item?._id || `${index}-${resolveAuthorName(item)}`}
        />
      ))}
    </div>
  );
}
