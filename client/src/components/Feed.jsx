import React, { useEffect, useMemo, useState } from "react";
import "./Feed.css";
import PinTagIcon from "../assets/Event_Pin.svg";
import DiscussionTagIcon from "../assets/chat-filled.svg";
import CommentsIcon from "../assets/Comments.png";
import InterestedIcon from "../assets/AttendanceIcon.png";
import { fetchPinAttendees } from "../api/mongoDataApi";
import runtimeConfig from "../config/runtime";

const DEFAULT_AVATAR = "https://i.pravatar.cc/100?img=64";

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

const TAG_ICON_MAP = {
  pin: {
    label: "Pin",
    icon: PinTagIcon,
  },
  discussion: {
    label: "Discussion",
    icon: DiscussionTagIcon,
  },
};

const resolveTagBadge = (type) => {
  const key = typeof type === "string" ? type.toLowerCase() : "";
  return TAG_ICON_MAP[key] || {
    label: "Item",
    icon: PinTagIcon,
  };
};

const attendeeCache = new Map();
const API_BASE_URL = (runtimeConfig.apiBaseUrl ?? "").replace(/\/$/, "");
const AVATAR_LIBRARY = [
  "/uploads/images/emulation/avatars/Demomanava.jpg",
  "/uploads/images/emulation/avatars/Engineerava.jpg",
  "/uploads/images/emulation/avatars/Heavyava.jpg",
  "/uploads/images/emulation/avatars/Medicava.jpg",
  "/uploads/images/emulation/avatars/Pyroava.jpg",
  "/uploads/images/emulation/avatars/Scoutava.jpg",
  "/uploads/images/emulation/avatars/Sniperava.jpg",
  "/uploads/images/emulation/avatars/Soldierava.jpg",
  "/uploads/images/emulation/avatars/Spyava.jpg",
];
const FALLBACK_NAMES = [
  "Scout",
  "Soldier",
  "Pyro",
  "Demoman",
  "Heavy",
  "Engineer",
  "Medic",
  "Sniper",
  "Spy",
];

const resolveLibraryAvatar = (seed = 0) => {
  if (!AVATAR_LIBRARY.length) {
    return DEFAULT_AVATAR;
  }
  const index = Math.abs(seed) % AVATAR_LIBRARY.length;
  const relative = AVATAR_LIBRARY[index];
  if (!relative) {
    return DEFAULT_AVATAR;
  }
  return API_BASE_URL ? `${API_BASE_URL}${relative}` : relative;
};

function FeedCard({ item }) {
  const cardType = item?.type ? String(item.type).toLowerCase() : "";
  const images = Array.isArray(item?.images) ? item.images.filter(Boolean) : [];
  const authorName = resolveAuthorName(item);
  const baseKey = item?.id || item?._id || authorName || "item";
  const tagBadge = resolveTagBadge(cardType);
  const pinId = item?._id || item?.id;
  const isEventPin = cardType === "pin";
  const isValidPinId =
    typeof pinId === "string" && /^[0-9a-fA-F]{24}$/.test(pinId);
  const participantCount =
    typeof item?.participantCount === "number" ? item.participantCount : null;

  const interestedNames = useMemo(
    () =>
      Array.isArray(item?.interested) ? item.interested.filter(Boolean) : [],
    [item]
  );

  const [attendees, setAttendees] = useState([]);

  useEffect(() => {
    if (!isEventPin || !isValidPinId) {
      setAttendees([]);
      return;
    }

    if (attendeeCache.has(pinId)) {
      setAttendees(attendeeCache.get(pinId));
      return;
    }

    let cancelled = false;
    fetchPinAttendees(pinId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        const mapped = Array.isArray(payload)
          ? payload.map((record, idx) => ({
              id:
                record?._id ||
                record?.userId ||
                `${pinId}-attendee-${idx}`,
              name:
                record?.displayName ||
                record?.username ||
                record?.email ||
                `Guest ${idx + 1}`,
              avatar:
                record?.avatar?.thumbnailUrl ||
                record?.avatar?.url ||
                resolveLibraryAvatar(idx),
            }))
          : [];
        attendeeCache.set(pinId, mapped);
        setAttendees(mapped);
      })
      .catch(() => {
        if (!cancelled) {
          setAttendees([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isEventPin, isValidPinId, pinId]);

  const fallbackAttendees = useMemo(() => {
    if (!isEventPin) {
      return [];
    }
    if (participantCount === 0) {
      return [];
    }
    const seeds =
      interestedNames.length > 0 ? interestedNames : FALLBACK_NAMES;
    return seeds.map((name, idx) => ({
      id: `${baseKey}-fallback-${idx}`,
      name: String(name),
      avatar: resolveLibraryAvatar(idx),
    }));
  }, [isEventPin, interestedNames, baseKey, participantCount]);

  const resolvedAttendees = attendees.length ? attendees : fallbackAttendees;
  const attendeeTotal = attendees.length
    ? attendees.length
    : participantCount ?? resolvedAttendees.length;
  const displayedAttendees = resolvedAttendees.slice(
    0,
    Math.min(5, attendeeTotal)
  );
  const remainingAttendees = Math.max(
    0,
    attendeeTotal - displayedAttendees.length
  );
  const shouldShowAttendees =
    isEventPin && displayedAttendees.length > 0 && attendeeTotal > 0;

  return (
    <article className={`card ${cardType}`}>
      <header className={`card-header ${cardType}`}>
        <div className="tag">
          <img
            src={tagBadge.icon}
            className="tag-icon"
            alt=""
            aria-hidden="true"
          />
          <span>{item?.tag || tagBadge.label}</span>
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
          {shouldShowAttendees &&
            displayedAttendees.map((attendee) => (
              <span
                className="interest-bubble"
                key={attendee.id ?? `${baseKey}-attendee-${attendee.name}`}
                title={attendee.name}
              >
                <img
                  src={attendee.avatar || DEFAULT_AVATAR}
                  alt=""
                  className="interest-avatar"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = DEFAULT_AVATAR;
                  }}
                />
              </span>
            ))}
          {shouldShowAttendees && remainingAttendees > 0 && (
            <span className="interest-more">+{remainingAttendees}</span>
          )}
        </div>

        <div className="counts">
          {typeof item?.comments === "number" && (
            <span className="count-item" title="Comments">
              <img src={CommentsIcon} alt="" className="count-icon" aria-hidden="true" />
              <span>{item.comments}</span>
            </span>
          )}

          {isEventPin && attendeeTotal > 0 && (
            <span className="count-item" title="Attendees">
              <img src={InterestedIcon} alt="" className="count-icon" aria-hidden="true" />
              <span>{attendeeTotal}</span>
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










