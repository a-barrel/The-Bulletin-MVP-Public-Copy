import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import './PinDetails.css';
import PlaceIcon from '@mui/icons-material/Place'; // used only for pageConfig
import DebugPin from '../models/DebugPin';
import { fetchPinById } from '../api/mongoDataApi';

export const pageConfig = {
  id: 'pin-details',
  label: 'Pin Details',
  icon: PlaceIcon,
  path: '/pin/:pinId',
  order: 3,
  showInNav: false
};

function PinDetails() {
  const { pinId } = useParams();
  const [pin, setPin] = useState(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [attending, setAttending] = useState(false);

  useEffect(() => {
    async function loadPin() {
      try {
        const payload = await fetchPinById(pinId);
        // const pinData = DebugPin.fromApi(payload);
        //console.log('Fetched pin:', payload);   //for debugging
        setPin(payload);
      } catch (error) {
        console.error('Failed to fetch pin:', error);
      }
    }
    loadPin();
  }, [pinId]);

  return (
    <div className='pin-details'>
      {/* Header */}
      <header className='header'>
        <Link to="/list" className="back-button">
          <img
            src='https://www.svgrepo.com/show/326886/arrow-back-sharp.svg'
            className='back-arrow'
          />
        </Link>

        <h2>{pin ? pin.type.charAt(0).toUpperCase() + pin.type.slice(1) : 'Loading...'}</h2>

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

      {/* Event/Discussion Name */}
      <div className='name'>
        <h2>{pin ? pin.title : 'Loading...'}</h2>
      </div>

      {/* Map section */}
      <div className='map-section'>
        do map here
      </div>

      {/* Post creator */}
      <div className='post-creator'>
        <img
          src='https://www.svgrepo.com/show/343494/profile-user-account.svg'
          className='profile-icon'
        />
        <p>{pin ? pin.creator.displayName : 'Loading...'}</p>
      </div>

      {/* Post description */}
      <div className='post-description'>{pin ? pin.description : "Loading..."}</div>

      {/* Post images */}
      <div className='post-images'>
        do post images here
      </div>

      {/* Post info */}
      <div className='post-info'>
        <div className='post-location'>
          <img
            src='https://www.svgrepo.com/show/345061/pin.svg'
            className='pin-icon'
          />
          <span className='location-text'>
            Location:<br />
            {pin ? pin.address.components.line1 + ', ' + pin.address.components.city + ', ' + pin.address.components.state : 'Loading...'}
          </span>
        </div>

        <div className='post-occurance'>
          <img
            src='https://www.svgrepo.com/show/533378/calendar.svg'
            className='calendar-icon'
          />
          <span className='occurance-text'>
            Occurs:<br />
            {pin ? (
              `${new Date(pin.startDate).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "numeric",
                hour12: true
              })} - ${new Date(pin.endDate).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "numeric",
                hour12: true
              })}`
            ) : (
              "Loading..."
            )}
          </span>
        </div>

        <div className='post-attendance'>
          <img
            src='https://www.svgrepo.com/show/511192/user-check.svg'
            className='attendance-icon'
          />
          <span className='attendance-text'>
            {pin ? `${pin.participantCount ?? 0} Attending` : "Loading..."}<br />
            <img
              src='https://www.svgrepo.com/show/343494/profile-user-account.svg'
              className='attending-icons'
            />
          </span>
        </div>
      </div>

      {/* Attend button */}
      <div className='attendance'>
        <button
          className={`attend-button ${attending ? 'attending' : ''}`}
          onClick={() => setAttending(!attending)}
        >
          {attending ? 'Attending!' : 'Attend'}
        </button>
      </div>

      {/* Comments header */}
      <div className='comments-header'>
        <img
          src='https://www.svgrepo.com/show/361088/comment-discussion.svg'
          className='comment-icon'
        />
        <p>Comments ({pin ? pin.stats.replyCount : "Loading..."})</p>
      </div>

      {/* Comments section */}
      <div className='comments-section'>
        <div className='comment'>
          <div className='comment-header'>
            <img
              src='https://www.svgrepo.com/show/343494/profile-user-account.svg'
              className='commenter-pfp'
            />
            <span className='commenter-info'>
              Username987<br />
              Oct 11, 1:11 PM
            </span>
          </div>

          <div className='comment-body'>
            <p>This is a comment</p>
          </div>
        </div>
      </div>

      {/* Create comment button */}
      <button className='create-comment'>
        <img
          src='https://www.svgrepo.com/show/489238/add-comment.svg'
          className='create-comment-button'
        />
      </button>
    </div>
  );
}

export default PinDetails;
