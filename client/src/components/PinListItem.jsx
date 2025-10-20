import React from 'react';
import { useNavigate } from 'react-router-dom';
import './PinListItem.css';

function PinListItem({ pin, onClick }) {
  const navigate = useNavigate();

  const handleAuthorClick = (e) => {
    e.stopPropagation(); // Prevent triggering the pin click
    if (pin.creatorId || pin.creator?._id) {
      const authorId = pin.creatorId || pin.creator._id;
      navigate(`/user/${authorId}`);
    }
  };

  return (
    <div className="pin-list-item" onClick={() => onClick(pin)}>
      <div className="pin-list-item__title-row">
        <h3 className="pin-list-item__title">{pin.title}</h3>
        <span className="pin-list-item__meta">#{pin._id}</span>
      </div>
      <p className="pin-list-item__desc">{pin.description}</p>
      <div className="pin-list-item__footer">
        <span className="pin-list-item__loc">{pin.locationName}</span>
        <span 
          className="pin-list-item__author pin-list-item__author--clickable"
          onClick={handleAuthorClick}
        >
          {pin.creator?.displayName || pin.creator?.username || pin.authorName}
        </span>
      </div>
    </div>
  );
}

export default PinListItem;


