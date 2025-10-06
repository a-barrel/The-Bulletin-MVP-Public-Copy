import React from 'react';
import { Link, useParams } from 'react-router-dom';
import './PinDetails.css';

function PinDetails() {
  const { pinId } = useParams();
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <header className='header'>
        <h1>Events</h1>
      </header>

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

      <button className='attendance-button'>
        do attendance button here
      </button>

      <div className='comments-section'>
        do comments section here
      </div>

      <button className='create-comment'>
        do comment button and place on bottom right
      </button>



      <h1>Pin Details for Pin {pinId}</h1>
      <Link to="/list">Go to List</Link>
    </div>
  );
}

export default PinDetails;
