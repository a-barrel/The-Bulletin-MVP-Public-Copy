import React from 'react';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import './SortToggle.css';

function SortToggle({ sortByExpiration, onToggle }) {
  const label = sortByExpiration ? 'Expiration' : 'Distance';
  return (
    <button className="sort-toggle" onClick={onToggle} type="button">
      <SwapVertIcon className="sort-icon" />
      <span className="sort-text">
        Sort by: <span className={sortByExpiration ? 'expiration-text' : 'distance-text'}>{label}</span>
      </span>
    </button>
  );
}

export default SortToggle;
