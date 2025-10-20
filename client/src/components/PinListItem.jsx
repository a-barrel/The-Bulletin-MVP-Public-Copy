import React from 'react';
import './PinListItem.css';

function PinListItem({ pin, onClick }) {
  return (
    <div className="pin-list-item" onClick={() => onClick(pin)}>
      <div className="pin-list-item__title-row">
        <h3 className="pin-list-item__title">{pin.title}</h3>
        <span className="pin-list-item__meta">#{pin._id}</span>
      </div>
      <p className="pin-list-item__desc">{pin.description}</p>
      <div className="pin-list-item__footer">
        <span className="pin-list-item__loc">{pin.locationName}</span>
        <span className="pin-list-item__author">{pin.authorName}</span>
      </div>
    </div>
  );
}

export default PinListItem;


