import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import './PinDetails.css';

function PinDetails() {
  const { pinId } = useParams();
  const [bookmarked, setBookmarked] = useState(false);
  const [attending, setAttending] = useState(false);
  
  return (
    <div className='pin-details'>
      <header className='header'>
        <button className='back-button'>
          <img 
            src='https://www.svgrepo.com/show/326886/arrow-back-sharp.svg' 
            className='back-arrow'
          />
        </button>

        <h2>pin type here</h2>

        <button 
          className='bookmark-button' 
          onClick={() => setBookmarked(!bookmarked)}
        >
          <img 
            src={
              bookmarked 
                ? 'https://www.svgrepo.com/show/357397/bookmark-full.svg' // not bookmarked
                : 'https://www.svgrepo.com/show/347684/bookmark-fill.svg' // bookmarked
            }
            className='bookmark'
          />
        </button>
      </header>

      <div className='name'>
        do event name here
      </div>

      <div className='map-section'>
        do map here
      </div>

      <div className='post-creator'>
        do post creator pfp with username here
      </div>

      <div className='post-description'>
        do post description here
      </div>

      <div className='post-images'>
        do post images here
      </div>

      <div className='post-information'>
        do post location, occurance, and attendees list here
      </div>

      <div className='attendance'>
        <button 
          className={`attend-button ${attending ? 'attending' : ''}`}
          onClick={() => setAttending(!attending)}
        >
          {attending ? 'Attending!' : 'Attend'}
        </button>
      </div>      

      <div className='comments-section'>
        do comments section here
      </div>

      <button className='create-comment'>
        do comment button and place on bottom right
      </button>

      {/* delete here later, for debugging */}
      <p>Pin Details for Pin {pinId}</p>
      <Link to="/list">Go to List</Link>
    </div>
  );
}

export default PinDetails;
