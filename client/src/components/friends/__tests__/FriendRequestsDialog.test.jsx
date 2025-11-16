import { fireEvent, render, screen } from '@testing-library/react';
import FriendRequestsDialog from '../FriendRequestsDialog';

const requests = [
  {
    id: 'req-1',
    requester: { displayName: 'Casey' },
    createdAt: '2024-01-01T00:00:00Z',
    message: 'Let us connect'
  }
];

describe('FriendRequestsDialog', () => {
  it('renders pending requests and handles responses', () => {
    const handleRespond = jest.fn();
    const handleClose = jest.fn();

    render(
      <FriendRequestsDialog
        open
        onClose={handleClose}
        requests={requests}
        actionStatus={{ type: 'info', message: 'Ready' }}
        respondingRequestId={null}
        onRespond={handleRespond}
        formatTimestamp={() => 'Just now'}
      />
    );

    expect(screen.getByText(/Pending Friend Requests/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Accept/i));
    expect(handleRespond).toHaveBeenCalledWith('req-1', 'accept');
    fireEvent.click(screen.getByText(/Decline/i));
    expect(handleRespond).toHaveBeenCalledWith('req-1', 'decline');
  });

  it('shows empty state when no requests exist', () => {
    render(<FriendRequestsDialog open requests={[]} />);
    expect(screen.getByText(/no pending friend requests/i)).toBeInTheDocument();
  });
});
