import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PinListItem from '../components/PinListItem';

function ListPage() {
  const navigate = useNavigate();
  const pins = [
    { _id: '123', title: 'Lost Dog', description: 'Brown lab seen near park.', locationName: 'Central Park', authorName: 'Alex' },
    { _id: '456', title: 'Free Couch', description: 'On the curb, first come.', locationName: '5th Ave', authorName: 'Sam' },
    { _id: '789', title: 'Community Cleanup', description: 'Saturday 9am by the river.', locationName: 'Riverside', authorName: 'Taylor' }
  ];

  const handleOpenPin = (pin) => {
    navigate(`/pin/${pin._id}`);
  };

  return (
    <div style={{ padding: '1rem', maxWidth: 600, margin: '0 auto' }}>
      <h1>List Page</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {pins.map((pin) => (
          <PinListItem key={pin._id} pin={pin} onClick={handleOpenPin} />
        ))}
      </div>
      <br />
      <Link to="/map">Go to Map</Link>
    </div>
  );
}

export default ListPage;
