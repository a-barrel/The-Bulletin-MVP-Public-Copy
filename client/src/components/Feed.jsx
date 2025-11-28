import React, { memo } from "react";
import "./Feed.css";
import PinCard from "./PinCard";
import { resolveAuthorName } from "../utils/feed";
import EmptyStateCard from "./EmptyStateCard";

// Feed only manages the list container and passes each item to PinCard so every surface shares identical card UX.

function Feed({ items, onSelectItem, onSelectAuthor, cardProps }) {
  if (!Array.isArray(items) || items.length === 0) {
    return (
      <div className="feed">
        <EmptyStateCard message="No nearby pins yet. Check back soon!" />
      </div>
    );
  }

  return (
    <div className="feed">
      {items.map((item, index) => (
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

const areFeedPropsEqual = (prevProps, nextProps) =>
  prevProps.items === nextProps.items &&
  prevProps.onSelectItem === nextProps.onSelectItem &&
  prevProps.onSelectAuthor === nextProps.onSelectAuthor &&
  prevProps.cardProps === nextProps.cardProps;

Feed.displayName = 'Feed';

export default memo(Feed, areFeedPropsEqual);








