import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./Feed.css";
import PinTagIcon from "../assets/Event_Pin.svg";
import DiscussionTagIcon from "../assets/chat-filled.svg";
import CommentsIcon from "../assets/Comments.png";
import InterestedIcon from "../assets/AttendanceIcon.png";
import { fetchPinAttendees } from "../api/mongoDataApi";
import resolveAssetUrl from "../utils/media";
import toIdString from "../utils/ids";

const DEFAULT_AVATAR = "https://i.pravatar.cc/100?img=64";

const resolveAuthorName = (item) =>
  item?.authorName ||
  item?.author ||
  item?.creator?.displayName ||
  item?.creator?.username ||
  "Unknown";

const resolveAvatar = (item) =>
  resolveAssetUrl(item?.creator?.avatar) ||
  resolveAssetUrl(item?.avatar) ||
  DEFAULT_AVATAR;

const TAG_ICON_MAP = {
  pin: {
    label: "Event",
    icon: PinTagIcon,
  },
  discussion: {
    label: "Discussion",
    icon: DiscussionTagIcon,
  },
};

const resolveTagBadge = (type) => {
  const key = typeof type === "string" ? type.toLowerCase() : "";
  if (key === "event") {
    return TAG_ICON_MAP.pin;
  }
  if (key === "chat") {
    return TAG_ICON_MAP.discussion;
  }
  return TAG_ICON_MAP[key] || TAG_ICON_MAP.pin;
};

const attendeeCache = new Map();
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
  const normalizedSeed = Number.isFinite(seed) ? Math.abs(Math.floor(seed)) : 0;
  return `https://i.pravatar.cc/100?u=pinpoint-fallback-${normalizedSeed}`;
};

function FeedCard({ item, onSelectItem, onSelectAuthor }) {
  const rawType = item?.type ? String(item.type).toLowerCase() : "";
  const normalizedType =
    rawType === "event"
      ? "pin"
      : rawType === "chat"
      ? "discussion"
      : rawType;
  const visualType = normalizedType === "discussion" ? "discussion" : "pin";
  const images = Array.isArray(item?.images) ? item.images.filter(Boolean) : [];
  const authorName = resolveAuthorName(item);
  const pinId =
    toIdString(item?.pinId) ??
    toIdString(item?._id) ??
    toIdString(item?.id);
  const authorId =
    toIdString(item?.authorId) ??
    toIdString(item?.creatorId) ??
    toIdString(item?.creator?._id);
  const baseKey = pinId || item?.id || item?._id || authorName || "item";
  const tagBadge = resolveTagBadge(normalizedType);
  const cardClassName = `card ${visualType}${pinId ? " clickable" : ""}`;
  const isEventPin = visualType === "pin";
  const isValidPinId =
    typeof pinId === "string" && /^[0-9a-fA-F]{24}$/.test(pinId);
  const participantCount =
    typeof item?.participantCount === "number" ? item.participantCount : null;

  const attendeeIds = useMemo(
    () =>
      Array.isArray(item?.attendeeIds)
        ? item.attendeeIds.filter(Boolean)
        : [],
    [item?.attendeeIds]
  );

  const attendeeSignature = useMemo(() => {
    if (typeof item?.attendeeVersion === "string") {
      const trimmed = item.attendeeVersion.trim();
      if (trimmed) {
        return trimmed;
      }
    }
    return attendeeIds.length > 0 ? attendeeIds.join("|") : null;
  }, [attendeeIds, item?.attendeeVersion]);

  const interestedNames = useMemo(
    () =>
      Array.isArray(item?.interested) ? item.interested.filter(Boolean) : [],
    [item]
  );

  const [attendees, setAttendees] = useState([]);

  const badgeLabel =
    typeof item?.title === "string" && item.title.trim()
      ? item.title.trim()
      : tagBadge.label;
  const badgeTitle =
    badgeLabel === tagBadge.label
      ? tagBadge.label
      : `${tagBadge.label} - ${badgeLabel}`;

  useEffect(() => {
    if (!isEventPin || !isValidPinId) {
      setAttendees([]);
      return;
    }

    const expectedCount = Number.isFinite(participantCount)
      ? participantCount
      : null;
    const expectedSignature = attendeeSignature || null;

    const cachedEntry = attendeeCache.get(pinId);
    if (cachedEntry) {
      setAttendees(Array.isArray(cachedEntry.items) ? cachedEntry.items : []);
      const matchesCount =
        expectedCount === null || cachedEntry.count === expectedCount;
      const matchesSignature =
        expectedSignature === null || cachedEntry.signature === expectedSignature;
      if (matchesCount && matchesSignature) {
        return;
      }
    }

    let cancelled = false;
    fetchPinAttendees(pinId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        const normalizedIds = [];
        const mapped = Array.isArray(payload)
          ? payload.map((record, idx) => {
              const normalizedId =
                toIdString(record?.userId) ??
                toIdString(record?._id) ??
                toIdString(record?.profile?._id) ??
                toIdString(record?.profile?.userId) ??
                toIdString(record?.user?._id);
              if (normalizedId && !normalizedIds.includes(normalizedId)) {
                normalizedIds.push(normalizedId);
              }
              const name =
                record?.displayName ||
                record?.username ||
                record?.profile?.displayName ||
                record?.profile?.username ||
                record?.email ||
                record?.profile?.email ||
                `Guest ${idx + 1}`;
              const avatar =
                resolveAssetUrl(
                  record?.avatar ||
                    record?.profile?.avatar ||
                    record?.user?.avatar
                ) ?? resolveLibraryAvatar(idx);
              return {
                id: normalizedId ?? `${pinId}-attendee-${idx}`,
                userId: normalizedId ?? null,
                name,
                avatar,
                raw: record,
              };
            })
          : [];
        const signature =
          normalizedIds.length > 0
            ? normalizedIds.join("|")
            : expectedSignature;
        attendeeCache.set(pinId, {
          items: mapped,
          count: mapped.length,
          signature,
          updatedAt: Date.now(),
        });
        setAttendees(mapped);
      })
      .catch(() => {
        if (!cancelled) {
          attendeeCache.set(pinId, {
            items: [],
            count: 0,
            signature: expectedSignature,
            updatedAt: Date.now(),
          });
          setAttendees([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attendeeSignature, isEventPin, isValidPinId, participantCount, pinId]);

  const fallbackAttendees = useMemo(() => {
    if (!isEventPin) {
      return [];
    }
    const interestedCount = interestedNames.length;
    const statsCount = Number.isFinite(participantCount) ? participantCount : 0;
    const desiredCount = Math.max(interestedCount, statsCount);
    if (desiredCount <= 0) {
      return [];
    }
    const seeds =
      interestedCount > 0 ? interestedNames : FALLBACK_NAMES;
    return seeds.slice(0, desiredCount).map((name, idx) => ({
      id: `${baseKey}-fallback-${idx}`,
      userId: null,
      name: String(name),
      avatar: resolveLibraryAvatar(idx),
    }));
  }, [isEventPin, interestedNames, baseKey, participantCount]);

  const resolvedAttendees = attendees.length ? attendees : fallbackAttendees;
  const hasAttendeeAvatars = resolvedAttendees.length > 0;
  const shouldShowAttendees = isEventPin && hasAttendeeAvatars;
  const displayAttendees = useMemo(() => {
    if (!shouldShowAttendees) {
      return [];
    }
    const creatorAvatarUrl = resolveAssetUrl(item?.creator?.avatar, { fallback: DEFAULT_AVATAR });
    return resolvedAttendees.map((attendee, idx) => {
      if (!attendee) {
        return null;
      }
      const normalizedId =
        toIdString(attendee.userId) ??
        toIdString(attendee.id) ??
        toIdString(attendee._id) ??
        toIdString(attendee.raw?.userId) ??
        toIdString(attendee.raw?._id) ??
        toIdString(attendee.raw?.profile?._id) ??
        toIdString(attendee.raw?.profile?.userId);

      const rawAvatar =
        resolveAssetUrl(attendee.avatar) ??
        resolveAssetUrl(attendee.raw?.avatar) ??
        resolveAssetUrl(attendee.raw?.profile?.avatar) ??
        resolveAssetUrl(attendee.raw?.user?.avatar);

      const matchesCreator = authorId && normalizedId && normalizedId === authorId;
      const avatar =
        rawAvatar ||
        (matchesCreator ? creatorAvatarUrl : null) ||
        resolveLibraryAvatar(idx);

      return {
        ...attendee,
        userId: normalizedId ?? attendee.userId ?? attendee.id ?? null,
        avatar,
      };
    }).filter(Boolean);
  }, [authorId, item, resolvedAttendees, shouldShowAttendees]);
  const attendeeTotal = Number.isFinite(participantCount)
    ? Math.max(participantCount, resolvedAttendees.length)
    : resolvedAttendees.length;
  const remainingAttendees = Math.max(
    0,
    attendeeTotal - displayAttendees.length
  );
  const handleCardClick = useCallback(() => {
    if (typeof onSelectItem === "function" && pinId) {
      onSelectItem(pinId, item);
    }
  }, [onSelectItem, pinId, item]);
  const handleCardKeyDown = useCallback(
    (event) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleCardClick();
      }
    },
    [handleCardClick]
  );
  const handleAuthorClick = useCallback(
    (event) => {
      event.stopPropagation();
      if (typeof onSelectAuthor === "function" && authorId) {
        onSelectAuthor(authorId, item);
      }
    },
    [authorId, item, onSelectAuthor]
  );
  const handleBookmarkClick = useCallback((event) => {
    event.stopPropagation();
  }, []);
  const handleAttendeeClick = useCallback(
    (event, attendee) => {
      event.stopPropagation();
      if (!attendee) {
        return;
      }
      const attendeeId =
        toIdString(attendee.userId) ??
        toIdString(attendee.id) ??
        toIdString(attendee._id);
      if (typeof onSelectAuthor === "function" && attendeeId) {
        onSelectAuthor(attendeeId, attendee);
      }
    },
    [onSelectAuthor]
  );
  const attendeesRowRef = useRef(null);
  const [attendeesScrollable, setAttendeesScrollable] = useState(false);

  useEffect(() => {
    const node = attendeesRowRef.current;
    if (!node || !shouldShowAttendees) {
      setAttendeesScrollable(false);
      return;
    }

    const updateScrollable = () => {
      const scrollable = node.scrollWidth - node.clientWidth > 1;
      setAttendeesScrollable(scrollable);
    };

    updateScrollable();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateScrollable);
      observer.observe(node);
      return () => {
        observer.disconnect();
      };
    }

    window.addEventListener("resize", updateScrollable);
    return () => {
      window.removeEventListener("resize", updateScrollable);
    };
  }, [displayAttendees, shouldShowAttendees]);

  const attendeesRequireScroll =
    shouldShowAttendees && attendeesScrollable;

  return (
    <article
      className={cardClassName}
      onClick={pinId ? handleCardClick : undefined}
      onKeyDown={pinId ? handleCardKeyDown : undefined}
      tabIndex={pinId ? 0 : undefined}
      role={pinId ? "button" : undefined}
      data-pin-id={pinId ?? undefined}
    >
      <header className={`card-header ${visualType}`}>
        <div className="tag" title={badgeTitle}>
          <img
            src={tagBadge.icon}
            className="tag-icon"
            alt=""
            aria-hidden="true"
          />
          <span>{badgeLabel}</span>
        </div>
        <div className="meta-right">
          {item?.distance && <span className="distance">{item.distance}</span>}
          {item?.distance && item?.timeLabel && <span className="dot">|</span>}
          {item?.timeLabel && <span className="time">{item.timeLabel}</span>}
          <button
            type="button"
            className="bookmark-btn"
            aria-label="Bookmark pin"
            onClick={handleBookmarkClick}
          >
            <span className="bookmark-emoji" role="img" aria-hidden="true">
              [*]
            </span>
          </button>
        </div>
      </header>

      {item?.text && <p className="card-text">{item.text}</p>}

      {images.length > 0 && (
        images.length >= 3 ? (
          <div className="media-scroll" aria-label="Pin photos" role="list">
            {images.map((src, imgIndex) => (
              <img
                key={`${baseKey}-media-${imgIndex}`}
                src={src}
                className="media scroll-item"
                alt=""
                loading="lazy"
                role="listitem"
              />
            ))}
          </div>
        ) : (
          <div
            className={`media-grid ${
              images.length === 1 ? "one" : "two"
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
        )
      )}

      <footer className="card-footer">
        <button
          type="button"
          className="author author-button"
          onClick={handleAuthorClick}
          aria-label={
            authorId ? `View ${authorName}'s profile` : undefined
          }
          disabled={!authorId}
        >
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
        </button>

        <div
          className={`interested-row${
            attendeesRequireScroll ? " scrollable" : ""
          }`}
          ref={attendeesRowRef}
        >
          {shouldShowAttendees &&
            displayAttendees.map((attendee, attendeeIndex) => (
              <button
                type="button"
                className="interest-bubble"
                key={
                  attendee.userId ??
                  attendee.id ??
                  attendee._id ??
                  `${baseKey}-attendee-${attendee.name}-${attendeeIndex}`
                }
                title={attendee.name}
                onClick={(event) => handleAttendeeClick(event, attendee)}
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
              </button>
            ))}
          {shouldShowAttendees && attendeeTotal > resolvedAttendees.length && (
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

export default function Feed({ items, onSelectItem, onSelectAuthor }) {
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
          onSelectItem={onSelectItem}
          onSelectAuthor={onSelectAuthor}
          key={item?.id || item?._id || `${index}-${resolveAuthorName(item)}`}
        />
      ))}
    </div>
  );
}










