import React, { memo } from "react";
import "./Feed.css";
import PinCard from "./PinCard";
import { resolveAuthorName } from "../utils/feed";
import EmptyStateCard from "./EmptyStateCard";

// Feed only manages the list container and passes each item to PinCard so every surface shares identical card UX.

function Feed({ items, onSelectItem, onSelectAuthor, cardProps, maxRenderCount }) {
  const renderItems =
    maxRenderCount && Array.isArray(items) ? items.slice(0, maxRenderCount) : items;

  if (!Array.isArray(renderItems) || renderItems.length === 0) {
    return (
      <div className="feed">
        <EmptyStateCard message="No nearby pins yet. Check back soon!" />
      </div>
    );
  }

  return (
    <div className="feed">
      {renderItems.map((item, index) => (
        <PinCard
          item={item}
          onSelectItem={onSelectItem}
          onSelectAuthor={onSelectAuthor}
          {...cardProps}
          key={item?.id || item?._id || `${index}-${resolveAuthorName(item)}`}
        />
      ))}
    </div>
  );
}

const itemsShallowEqual = (prevItems, nextItems) => {
  if (prevItems === nextItems) {
    return true;
  }
  if (!Array.isArray(prevItems) || !Array.isArray(nextItems)) {
    return false;
  }
  if (prevItems.length !== nextItems.length) {
    return false;
  }
  for (let i = 0; i < prevItems.length; i += 1) {
    const prev = prevItems[i];
    const next = nextItems[i];
    if (
      prev === next ||
      (prev?.id === next?.id &&
        prev?._id === next?._id &&
        prev?.pinId === next?.pinId &&
        prev?.viewerHasBookmarked === next?.viewerHasBookmarked &&
        prev?.viewerIsAttending === next?.viewerIsAttending &&
        prev?.participantCount === next?.participantCount &&
        prev?.comments === next?.comments)
    ) {
      continue;
    }
    return false;
  }
  return true;
};

const areFeedPropsEqual = (prevProps, nextProps) =>
  itemsShallowEqual(prevProps.items, nextProps.items) &&
  prevProps.onSelectItem === nextProps.onSelectItem &&
  prevProps.onSelectAuthor === nextProps.onSelectAuthor &&
  prevProps.cardProps === nextProps.cardProps &&
  prevProps.maxRenderCount === nextProps.maxRenderCount;

Feed.displayName = 'Feed';

export default memo(Feed, areFeedPropsEqual);






