import React from 'react';
import { Link } from 'react-router-dom';
import './ListPage.css';
import commentsIcon from '../assets/Comments.png';
import attendanceIcon from '../assets/AttendanceIcon.png';
import Navbar from '../components/Navbar'; // ✅ import your Navbar component

const DUMMY_FEED = [
  {
    id: 'pin_1',
    type: 'pin', // pin | discussion
    tag: 'Potluck',
    distance: '6 mi',
    timeLabel: 'In 3 Days',
    text: 'Hosting a potluck at the park! Come bring your family and friends!',
    images: [
      'https://picsum.photos/seed/pot1/400/260',
      'https://picsum.photos/seed/pot2/400/260',
    ],
    author: 'Chicken__Man',
    comments: 8,
    saves: 2,
  },
  {
    id: 'disc_1',
    type: 'discussion',
    tag: 'Superman Premiere',
    distance: '6 mi',
    timeLabel: '4 Days Left',
    text: 'How did everyone feel about the new superman?',
    images: ['https://picsum.photos/seed/super/400/260'],
    author: 'MovieBuff',
    comments: 2,
    saves: 0,
  },
  {
    id: 'pin_2',
    type: 'pin',
    tag: 'Community Clean-up',
    distance: '2.4 mi',
    timeLabel: 'Tomorrow',
    text: 'Join us to spruce up the lake trail. Gloves and bags provided.',
    images: [],
    author: 'TrailCrew',
    comments: 3,
    saves: 5,
  },
];

function ListPage() {
  return (
    <div className="list-page">
      <div className="list-frame">
        <h1 className="list-title">List</h1>

        <div className="feed">
          {DUMMY_FEED.map((item) => (
            <article className="card" key={item.id}>
              <header className="card-header">
                <div className="tag">
                  {item.type === 'pin' ? '📍' : '💬'} <span>{item.tag}</span>
                </div>
                <div className="meta-right">
                  <span className="time">{item.timeLabel}</span>
                  <span className="dot">•</span>
                  <span className="dist">{item.distance}</span>
                </div>
              </header>

              <div className="card-body">
                <p className="card-text">{item.text}</p>

                {item.images?.length > 0 && (
                  <div
                    className={`media-grid ${
                      item.images.length > 1 ? 'two' : 'one'
                    }`}
                  >
                    {item.images.map((src, i) => (
                      <img className="media" src={src} alt="" key={i} />
                    ))}
                  </div>
                )}
              </div>

              <footer className="card-footer">
                <div className="author">
                  <div className="avatar" aria-hidden="true" />
                  <span className="name">@{item.author}</span>
                </div>
                <div className="counts">
                  <span title="Comments" className="count-item">
                    <img
                      src={commentsIcon}
                      alt="Comments"
                      className="count-icon"
                    />{' '}
                    {item.saves}
                  </span>
                  <span title="Attendance" className="count-item">
                    <img
                      src={attendanceIcon}
                      alt="Attendance"
                      className="count-icon"
                    />{' '}
                    {item.comments}
                  </span>
                </div>
              </footer>
            </article>
          ))}
        </div>
      </div>

      {/* ✅ Add Navbar below */}
      <Navbar />
    </div>
  );
}

export default ListPage;