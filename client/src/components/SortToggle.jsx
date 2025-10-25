import React from 'react';
import toggleLeftSolo from '../assets/toggle_left_solo.svg';
import toggleRightSolo from '../assets/toggle_right_solo.svg';
import './SortToggle.css';

function SortToggle({ sortByExpiration, onToggle }) {
  return (
    <div className="sort-toggle-container">
      <div className="sort-toggle" onClick={onToggle}>
        <img 
          src={sortByExpiration ? toggleRightSolo : toggleLeftSolo} 
          alt={sortByExpiration ? "Sort by Expiration" : "Sort by Distance"} 
          className="sort-icon" 
        />
        <span className="sort-text">
          Sort by: <span className={sortByExpiration ? "expiration-text" : "distance-text"}>
            {sortByExpiration ? "Expiration" : "Distance"}
          </span>
        </span>
      </div>
    </div>
  );
}

export default SortToggle;
