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
                ? 'https://www.svgrepo.com/show/347684/bookmark-fill.svg' // bookmarked 
                : 'https://www.svgrepo.com/show/357397/bookmark-full.svg' // not bookmarked
            }
            className='bookmark'
          />
        </button>
      </header>

      <div className='name'>
        <h2>Event Name</h2>
      </div>

      <div className='map-section'>
        do map here
      </div>

      <div className='post-creator'>
        <img 
          src='https://www.svgrepo.com/show/343494/profile-user-account.svg'
          className='profile-icon'
        />
        <p>Username123</p>
      </div>

      <div className='post-description'>
        do post description here: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
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

      <div className='comments-header'>
        <img 
          src='https://www.svgrepo.com/show/361088/comment-discussion.svg'
          className='comment-icon'
        />
        <p>Comments (n)</p> {/* n is for number of comments later */}
      </div>

      <div className='comments-section'>
        do commnets section here
      </div>

      <button className='create-comment'>
        <img 
          src='https://www.svgrepo.com/show/489238/add-comment.svg'
          className='create-comment-button'
        />
      </button>

      {/* delete here later, for debugging */}
      <p>Pin Details for Pin {pinId}</p>
      <Link to="/list">Go to List</Link>
    </div>
  );
}

export default PinDetails;
