import { render, screen, fireEvent } from '@testing-library/react';
import Feed from '../../src/components/Feed';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

jest.mock('../../src/assets/Comments.png', () => 'comments-icon');
jest.mock('../../src/assets/AttendanceIcon.png', () => 'attendance-icon');
jest.mock('../../src/assets/PinIcon.png', () => 'pin-icon');
jest.mock('../../src/assets/DiscussionIcon.png', () => 'discussion-icon');

describe('Feed component', () => {
  const items = [
    {
      id: 'pin_1',
      type: 'pin',
      tag: 'Cleanup',
      distance: '6 mi',
      timeLabel: 'In 3 Days',
      text: 'Join us for a beach cleanup.',
      images: [],
      author: 'CleanupCrew',
      comments: 3,
      saves: 2,
      creator: { _id: 'user_123', displayName: 'Cleanup Crew' }
    },
    {
      id: 'disc_1',
      type: 'discussion',
      tag: 'Discussion',
      distance: '2 mi',
      timeLabel: 'Today',
      text: 'Share your thoughts.',
      images: [],
      author: 'ChattyUser',
      comments: 1,
      saves: 0,
      creatorId: 'user_456'
    }
  ];

  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('renders a card for each feed item', () => {
    render(<Feed items={items} />);

    expect(screen.getByText('Cleanup')).toBeInTheDocument();
    expect(screen.getByText('Discussion')).toBeInTheDocument();
    expect(screen.getByText('Join us for a beach cleanup.')).toBeInTheDocument();
  });

  it('navigates to the pin page when a card is clicked', () => {
    render(<Feed items={items} />);

    fireEvent.click(screen.getByText('Join us for a beach cleanup.'));
    expect(mockNavigate).toHaveBeenCalledWith('/pin/pin_1');
  });

  it('navigates to the author profile when author name is clicked', () => {
    render(<Feed items={items} />);

    fireEvent.click(screen.getByText('@Cleanup Crew'));
    expect(mockNavigate).toHaveBeenCalledWith('/user/user_123');
  });
});
