import React from "react";
import "./Feed.css";
import PinCard from "./PinCard";
import { resolveAuthorName } from "../utils/feed";

export default function Feed({ items, onSelectItem, onSelectAuthor }) {
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










