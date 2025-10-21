import React, { useState, useCallback, useMemo } from "react";
import "./ListPage.css";
import PlaceIcon from '@mui/icons-material/Place'; // TODO: used only for Icon on pageConfig, maybe change with a list icon?
import commentsIcon from "../assets/Comments.png";
import attendanceIcon from "../assets/AttendanceIcon.png";
import Navbar from "../components/Navbar";
import SortToggle from "../components/SortToggle";
import pinIcon from "../assets/PinIcon.png";
import discussionIcon from "../assets/DiscussionIcon.png";
import settingsIcon from "../assets/GearIcon.svg";
import addIcon from "../assets/AddIcon.svg";
import menuIcon from "../assets/MenuIcon.svg";
import updatesIcon from "../assets/UpdateIcon.svg";
import Feed from "../components/Feed.jsx";

export const pageConfig = {
  id: 'list',      // id
  label: 'List',   // Label (used in debug nav.)
  icon: PlaceIcon, // TODO: maybe change with a list icon? Don't forget the import!
  path: '/list',   // Path
  order: 4,        // Where in debug nav it is ordered
  showInNav: true, // Shows in Debug Navigator(?)
  protected: true, // Checks if user is logged in
};

const DUMMY_FEED = [
  {
    id: "pin_1",
    type: "pin",
    tag: "Potluck",
    distance: "6 mi",
    timeLabel: "In 3 Days",
    text: "Hosting a potluck at the park! Come bring your family and friends!",
    images: [
      "https://picsum.photos/seed/pot1/400/260",
      "https://picsum.photos/seed/pot2/400/260",
    ],
    author: "Chicken__Man",
    comments: 8,
    saves: 2,
  },
  {
    id: "disc_1",
    type: "discussion",
    tag: "Superman Premiere",
    distance: "6 mi",
    timeLabel: "4 Days Left",
    text: "How did everyone feel about the new superman?",
    images: ["https://picsum.photos/seed/super/400/260"],
    author: "MovieBuff",
    comments: 2,
    saves: 0,
  },
  {
    id: "pin_2",
    type: "pin",
    tag: "Community Clean-up",
    distance: "2.4 mi",
    timeLabel: "Tomorrow",
    text: "Join us to spruce up the lake trail. Gloves and bags provided.",
    images: [],
    author: "TrailCrew",
    comments: 3,
    saves: 5,
  },
];

/* ---------- helpers used for sorting ---------- */
function milesFrom(dist = "") {
  const n = parseFloat(String(dist).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}
function hoursUntil(label = "") {
  const s = String(label).toLowerCase().trim();
  const hm = s.match(/in\s*(\d+(?:\.\d+)?)\s*hour|(\d+(?:\.\d+)?)\s*hour/);
  if (hm) return parseFloat(hm[1] ?? hm[2]) || 0;
  const dm = s.match(/in\s*(\d+(?:\.\d+)?)\s*day|(\d+(?:\.\d+)?)\s*day/);
  if (dm) return (parseFloat(dm[1] ?? dm[2]) || 0) * 24;
  const dl = s.match(/(\d+(?:\.\d+)?)\s*days?\s*left/);
  if (dl) return (parseFloat(dl[1]) || 0) * 24;
  if (/\btomorrow\b/.test(s)) return 24;
  if (/\btoday\b/.test(s) || /\b0\s*days?\b/.test(s)) return 1;
  return 999999;
}

export default function ListPage() {
  const [sortByExpiration, setSortByExpiration] = useState(false); // false = distance, true = expiration
  const handleSortToggle = useCallback(() => {
    setSortByExpiration(prev => !prev);
  }, []);

  const filteredAndSortedFeed = useMemo(() => {
    // Step 1: Filter out expired pins
    const filteredItems = DUMMY_FEED.filter(pin => {
      const hoursLeft = hoursUntil(pin.timeLabel);
      return hoursLeft > 0; // Only show non-expired pins
    });
    
    // Step 2: Sort the filtered items
    if (sortByExpiration) {
      filteredItems.sort((a, b) => {
        const ha = hoursUntil(a.timeLabel);
        const hb = hoursUntil(b.timeLabel);
        if (ha !== hb) return ha - hb;
        return milesFrom(a.distance) - milesFrom(b.distance);
      });
    } else {
      filteredItems.sort((a, b) => milesFrom(a.distance) - milesFrom(b.distance));
    }
    
    return filteredItems;
  }, [sortByExpiration]);

  return (
    <div className="list-page">
      <div className="list-frame">
        {/* 🔹 Top Header Bar */}
        {/* Fixed purple header bar */}
        <header className="header-bar">
          <button className="header-icon-btn" aria-label="Menu">
            <img src={menuIcon} alt="Menu" className="header-icon" />
          </button>

          <h1 className="header-title">List</h1>

          <button className="header-icon-btn" aria-label="Notifications">
            <img src={updatesIcon} alt="Notifications" className="header-icon" />
          </button>
        </header>


        {/* Topbar (Settings, Toggle, Sort, Add) */}
        <div className="topbar">
          <div className="top-left">
            <button className="icon-btn" type="button" aria-label="Settings">
              <img src={settingsIcon} alt="Settings" />
            </button>
            
            {/* Sort Toggle */}
            <SortToggle 
              sortByExpiration={sortByExpiration} 
              onToggle={handleSortToggle} 
            />
          </div>

          <button className="add-btn" type="button" aria-label="Add">
            <img src={addIcon} alt="Add" />
          </button>
        </div>

        {/* Feed (now a component) */}
        <Feed items={filteredAndSortedFeed} />

        <Navbar />
      </div>
    </div>
  );
}