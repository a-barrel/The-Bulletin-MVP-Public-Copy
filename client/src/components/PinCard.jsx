/**
 * PinCard is the shared “single pin” presenter used by List feeds and any future
 * surfaces that need the same card UX. Pass it a pin-like `item` plus optional callbacks:
 *   - `onSelectItem(pinId, item)` to open the pin when the card is clicked.
 *   - `onSelectAuthor(authorId, item)` to handle avatar/name clicks.
 * Use the boolean props (`showAttendeeAvatars`, `showBookmarkButton`, `enableBookmarkToggle`)
 * to toggle individual features per page, and forward a custom `className` (e.g. `pin-card--fluid`)
 * if the card needs to stretch inside a different layout.
 * 
 * Reference docs/frontend-api-cheatsheet.md (“PinCard Data Contract”) for the payload fields this card expects.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./PinCard.css";
import PinTagIcon from "../assets/Event_Pin.svg";
import DiscussionTagIcon from "../assets/chat-filled.svg";
import CommentsIcon from "../assets/Comments.png";
import InterestedIcon from "../assets/AttendanceIcon.png";
import { createPinBookmark, deletePinBookmark } from "../api/mongoDataApi";
import BookmarkButton from "./BookmarkButton";
import resolveAssetUrl from "../utils/media";
import toIdString from "../utils/ids";
import usePinAttendees from "../hooks/usePinAttendees";
import { useNetworkStatusContext } from "../contexts/NetworkStatusContext";
import { useSocialNotificationsContext } from "../contexts/SocialNotificationsContext";
import {
  DEFAULT_AVATAR,
  FALLBACK_NAMES,
  resolveAuthorAvatar,
  resolveAuthorName,
  resolveLibraryAvatar
} from "../utils/feed";
import { useTranslation } from "react-i18next";
// Reference docs/frontend-api-cheatsheet.md (“PinCard Data Contract”) for the payload fields this card expects.

const TAG_ICON_MAP = {
  pin: {
    label: "Event",
    icon: PinTagIcon
  },
  discussion: {
    label: "Discussion",
    icon: DiscussionTagIcon
  }
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

export default function PinCard({
  item,
  onSelectItem,
  onSelectAuthor,
  showAttendeeAvatars = true,
  showBookmarkButton = true,
  enableBookmarkToggle = true,
  className = ""
}) {
  const { t } = useTranslation();
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
  const cardClassName = [
    "card",
    "pin-card",
    visualType,
    pinId ? "clickable" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");
  const isEventPin = visualType === "pin";
  const isValidPinId =
    typeof pinId === "string" && /^[0-9a-fA-F]{24}$/.test(pinId);
  const participantCount =
    typeof item?.participantCount === "number" ? item.participantCount : null;
  const { isOffline } = useNetworkStatusContext();

  const attendeeIds = useMemo(
    () =>
      Array.isArray(item?.attendeeIds)
        ? item.attendeeIds.filter(Boolean)
        : [],
    [item?.attendeeIds]
  );

  const derivedBookmark = useMemo(() => {
    if (typeof item?.viewerHasBookmarked === "boolean") {
      return item.viewerHasBookmarked;
    }
    if (typeof item?.isBookmarked === "boolean") {
      return item.isBookmarked;
    }
    return false;
  }, [item?.viewerHasBookmarked, item?.isBookmarked]);
  const [isBookmarked, setIsBookmarked] = useState(derivedBookmark);
  const [isUpdatingBookmark, setIsUpdatingBookmark] = useState(false);
  const [bookmarkError, setBookmarkError] = useState(null);
  const viewerOwnsPin = Boolean(item?.viewerOwnsPin);
  const viewerIsAttending = Boolean(item?.viewerIsAttending);
  const socialNotifications = useSocialNotificationsContext();
  const friendLookup = useMemo(() => {
    const entries = Array.isArray(socialNotifications.friendData?.friends)
      ? socialNotifications.friendData.friends
      : [];
    const lookup = new Set();
    entries.forEach((friend) => {
      const id = toIdString(friend?.id ?? friend?._id ?? friend);
      if (id) {
        lookup.add(id);
      }
    });
    return lookup;
  }, [socialNotifications.friendData?.friends]);

  useEffect(() => {
    setIsBookmarked(derivedBookmark);
  }, [derivedBookmark]);

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

  const attendeesFeatureEnabled = showAttendeeAvatars && isEventPin;
  const friendAttendingCount = useMemo(() => {
    if (!isEventPin || !friendLookup.size || attendeeIds.length === 0) {
      return 0;
    }
    return attendeeIds.reduce((total, id) => {
      const normalized = toIdString(id);
      return normalized && friendLookup.has(normalized) ? total + 1 : total;
    }, 0);
  }, [attendeeIds, friendLookup, isEventPin]);

  const { attendees } = usePinAttendees({
    pinId,
    enabled: attendeesFeatureEnabled && isValidPinId,
    participantCount,
    attendeeSignature
  });

  const badgeLabel =
    typeof item?.title === "string" && item.title.trim()
      ? item.title.trim()
      : tagBadge.label;
  const badgeTitle =
    badgeLabel === tagBadge.label
      ? tagBadge.label
      : `${tagBadge.label} - ${badgeLabel}`;

  const fallbackAttendees = useMemo(() => {
    if (!attendeesFeatureEnabled) {
      return [];
    }
    const interestedCount = interestedNames.length;
    const statsCount = Number.isFinite(participantCount) ? participantCount : 0;
    const desiredCount = Math.max(interestedCount, statsCount);
    if (desiredCount <= 0) {
      return [];
    }
    const seeds = interestedCount > 0 ? interestedNames : FALLBACK_NAMES;
    return seeds.slice(0, desiredCount).map((name, idx) => ({
      id: `${baseKey}-fallback-${idx}`,
      userId: null,
      name: String(name),
      avatar: resolveLibraryAvatar(idx)
    }));
  }, [attendeesFeatureEnabled, interestedNames, baseKey, participantCount]);

  const resolvedAttendees =
    attendeesFeatureEnabled && attendees.length
      ? attendees
      : fallbackAttendees;
  const hasAttendeeAvatars = resolvedAttendees.length > 0;
  const shouldShowAttendees =
    attendeesFeatureEnabled && hasAttendeeAvatars;
  const displayAttendees = useMemo(() => {
    if (!shouldShowAttendees) {
      return [];
    }
    const creatorAvatarUrl = resolveAssetUrl(item?.creator?.avatar, {
      fallback: DEFAULT_AVATAR
    });
    return resolvedAttendees
      .map((attendee, idx) => {
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

        const matchesCreator =
          authorId && normalizedId && normalizedId === authorId;
        const avatar =
          rawAvatar ||
          (matchesCreator ? creatorAvatarUrl : null) ||
          resolveLibraryAvatar(idx);

        return {
          ...attendee,
          userId: normalizedId ?? attendee.userId ?? attendee.id ?? null,
          avatar
        };
      })
      .filter(Boolean);
  }, [authorId, item, resolvedAttendees, shouldShowAttendees]);
  const attendeeTotal = attendeesFeatureEnabled
    ? Number.isFinite(participantCount)
      ? Math.max(participantCount, resolvedAttendees.length)
      : resolvedAttendees.length
    : 0;
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
  const handleBookmarkClick = useCallback(
    async (event) => {
      event.stopPropagation();
      if (
        !enableBookmarkToggle ||
        !pinId ||
        isUpdatingBookmark ||
        viewerOwnsPin ||
        viewerIsAttending
      ) {
        return;
      }
      if (isOffline) {
        setBookmarkError("Reconnect to manage bookmarks.");
        return;
      }

      setIsUpdatingBookmark(true);
      setBookmarkError(null);
      const nextIsBookmarked = !isBookmarked;
      try {
        if (nextIsBookmarked) {
          await createPinBookmark(pinId);
        } else {
          await deletePinBookmark(pinId);
        }
        setIsBookmarked(nextIsBookmarked);
      } catch (error) {
        setBookmarkError(error?.message || "Failed to update bookmark.");
      } finally {
        setIsUpdatingBookmark(false);
      }
    },
    [
      enableBookmarkToggle,
      pinId,
      isBookmarked,
      isOffline,
      isUpdatingBookmark,
      viewerIsAttending,
      viewerOwnsPin
    ]
  );
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
  const bookmarkButtonVisible = showBookmarkButton;
  const bookmarkButtonDisabled =
    !enableBookmarkToggle || !pinId || isOffline;

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
          {item?.distance && (
            <span className="distance">{item.distance}</span>
          )}
          {item?.distance && item?.timeLabel && (
            <span className="dot">|</span>
          )}
          {item?.timeLabel && (
            <span className="time">{item.timeLabel}</span>
          )}
          {bookmarkButtonVisible && (
            <BookmarkButton
              variant="card"
              bookmarked={isBookmarked}
              pending={isUpdatingBookmark}
              disabled={bookmarkButtonDisabled}
              ownsPin={viewerOwnsPin}
              attending={viewerIsAttending}
              onToggle={handleBookmarkClick}
              stopPropagation
              tooltip={bookmarkError || undefined}
              disabledLabel={
                isOffline
                  ? "Reconnect to manage bookmarks"
                  : undefined
              }
              addLabel="Save bookmark"
              removeLabel="Remove bookmark"
            />
          )}
        </div>
      </header>

      {item?.text && <p className="card-text">{item.text}</p>}

      {images.length > 0 &&
        (images.length >= 3 ? (
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
        ))}

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
            src={resolveAuthorAvatar(item)}
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
                onClick={(event) =>
                  handleAttendeeClick(event, attendee)
                }
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
          {shouldShowAttendees &&
            attendeeTotal > resolvedAttendees.length && (
              <span className="interest-more">
                +{remainingAttendees}
              </span>
            )}
        </div>

        <div className="counts">
          {typeof item?.comments === "number" && (
            <span className="count-item" title={t('tooltips.comments')}>
              <img
                src={CommentsIcon}
                alt=""
                className="count-icon"
                aria-hidden="true"
              />
              <span>{item.comments}</span>
            </span>
          )}

          {isEventPin && attendeeTotal > 0 && (
            <span className="count-item" title={t('tooltips.attendees')}>
              <img
                src={InterestedIcon}
                alt=""
                className="count-icon"
                aria-hidden="true"
              />
              <span>{attendeeTotal}</span>
            </span>
          )}
          {isEventPin && friendAttendingCount > 0 && (
            <span className="count-item friend-count" title={t('tooltips.friendsAttending')}>
              <img
                src={InterestedIcon}
                alt=""
                className="count-icon friend-count-icon"
                aria-hidden="true"
              />
              <span>{friendAttendingCount}</span>
            </span>
          )}
        </div>
      </footer>
    </article>
  );
}
