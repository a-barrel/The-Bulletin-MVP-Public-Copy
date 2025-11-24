import React from "react";
import "./EmptyStateCard.css";

function EmptyStateCard({ message }) {
  return (
    <div className="card pin-card empty-card">
      <p className="card-text">{message}</p>
    </div>
  );
}

export default EmptyStateCard;
