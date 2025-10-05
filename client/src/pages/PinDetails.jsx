import React from 'react';
import { Link, useParams } from 'react-router-dom';

function PinDetails() {
  const { pinId } = useParams();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <h1>Pin Details for Pin {pinId}</h1>
      <Link to="/list">Go to List</Link>
    </div>
  );
}

export default PinDetails;
