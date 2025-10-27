import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './UserProfile.css';

function UserProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:5000/api/users/${userId}`, {
          headers: {
            'Authorization': 'Bearer demo-test-token'
          }
        });
        
        if (!response.ok) {
          throw new Error('User not found');
        }
        
        const userData = await response.json();
        setUser(userData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchUser();
    }
  }, [userId]);

  const handleBack = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="user-profile-page">
        <div className="phone-frame">
          <div className="loading">Loading user profile...</div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="user-profile-page">
        <div className="phone-frame">
          <div className="error">
            <h2>User Not Found</h2>
            <p>{error || 'This user does not exist.'}</p>
            <button onClick={handleBack} className="back-btn">
              ← Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="user-profile-page">
      <div className="phone-frame">
        {/* Header */}
        <div className="user-header">
          <button className="back-btn" onClick={handleBack}>
            ← Back
          </button>
          <h1 className="user-title">User Profile</h1>
        </div>

        {/* User Info */}
        <div className="user-info">
          <div className="user-avatar">
            <img 
              src={user.avatar?.url || '/default-avatar.png'} 
              alt={user.displayName || user.username}
              className="avatar-image"
            />
          </div>
          
          <div className="user-details">
            <h2 className="user-name">{user.displayName || user.username}</h2>
            <p className="user-handle">@{user.username}</p>
            
            {user.bio && (
              <p className="user-bio">{user.bio}</p>
            )}
          </div>
        </div>

        {/* User Stats */}
        {user.stats && (
          <div className="user-stats">
            <div className="stat-item">
              <span className="stat-number">{user.stats.eventsHosted || 0}</span>
              <span className="stat-label">Events Hosted</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{user.stats.eventsAttended || 0}</span>
              <span className="stat-label">Events Attended</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{user.stats.posts || 0}</span>
              <span className="stat-label">Posts</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{user.stats.followers || 0}</span>
              <span className="stat-label">Followers</span>
            </div>
          </div>
        )}

        {/* User Pins Section */}
        <div className="user-pins-section">
          <h3>User's Pins</h3>
          <p>Pins created by this user will be displayed here.</p>
        </div>
      </div>
    </div>
  );
}

export default UserProfile;
