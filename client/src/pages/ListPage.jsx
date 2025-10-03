import React from 'react';
import { Link } from 'react-router-dom';

function ListPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <h1>List Page</h1>
      <Link to="/map">Go to Map</Link>
      <br />
      <Link to="/pin/123">Go to Pin Details</Link>
    </div>
  );
}

export default ListPage;
