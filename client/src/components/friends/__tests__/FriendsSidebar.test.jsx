import { fireEvent, render, screen } from '@testing-library/react';
import FriendsSidebar from '../FriendsSidebar';

const friends = [
  { id: '1', displayName: 'Alice', username: 'alice' },
  { id: '2', displayName: 'Bob', username: 'bobby' }
];

describe('FriendsSidebar', () => {
  it('filters friends and triggers search callback', () => {
    const handleSearch = jest.fn();
    render(
      <FriendsSidebar
        friends={friends}
        searchQuery=""
        onSearchChange={handleSearch}
        notificationsLabel="Notifications"
        onOpenRequests={jest.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/search friends/i), {
      target: { value: 'bo' }
    });
    expect(handleSearch).toHaveBeenCalledWith('bo');
    expect(screen.getByText(/Friends — 2/)).toBeInTheDocument();
  });

  it('fires message/unfriend/report callbacks', () => {
    const handleMessage = jest.fn();
    const handleUnfriend = jest.fn();
    const handleReport = jest.fn();
    const handleRequests = jest.fn();

    render(
      <FriendsSidebar
        friends={[friends[0]]}
        searchQuery=""
        onSearchChange={() => {}}
        onMessageFriend={handleMessage}
        onUnfriend={handleUnfriend}
        onReportFriend={handleReport}
        notificationsLabel="Notifications"
        onOpenRequests={handleRequests}
      />
    );

    fireEvent.click(screen.getByLabelText(/Message friend/i));
    expect(handleMessage).toHaveBeenCalledWith(friends[0]);

    fireEvent.click(screen.getByLabelText(/Remove friend/i));
    expect(handleUnfriend).toHaveBeenCalledWith(friends[0]);

    fireEvent.click(screen.getByLabelText(/Report friend/i));
    expect(handleReport).toHaveBeenCalledWith(friends[0]);

    fireEvent.click(screen.getByLabelText(/Notifications/i));
    expect(handleRequests).toHaveBeenCalled();
  });
});
