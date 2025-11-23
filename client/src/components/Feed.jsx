import React, { memo } from "react";
import "./Feed.css";
import PinCard from "./PinCard";
import { resolveAuthorName } from "../utils/feed";

// Feed only manages the list container and passes each item to PinCard so every surface shares identical card UX.

function Feed({ items, onSelectItem, onSelectAuthor }) {
  if (!Array.isArray(items) || items.length === 0) {
    return (
      <div className="feed">
        <div className="card pin-card">
          <p className="card-text">No nearby pins yet. Check back soon!</p>
        </div>
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
          key={item?.id || item?._id || `${index}-${resolveAuthorName(item)}`}
        />
      ))}
    </div>
  );
}

const areFeedPropsEqual = (prevProps, nextProps) =>
  prevProps.items === nextProps.items &&
  prevProps.onSelectItem === nextProps.onSelectItem &&
  prevProps.onSelectAuthor === nextProps.onSelectAuthor;

export default memo(Feed, areFeedPropsEqual);










