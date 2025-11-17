import { fireEvent, render, screen } from '@testing-library/react';
import ChatRoomList from '../ChatRoomList';

const rooms = [
  { _id: 'room-1', name: 'Lounge', participantCount: 5, isGlobal: true },
  { _id: 'room-2', name: 'Coffee Shop', participantCount: 0, isGlobal: false }
];

describe('ChatRoomList', () => {
  it('renders rooms and handles selection + refresh', () => {
    const handleSelect = jest.fn();
    const handleRefresh = jest.fn();
    const handleCreate = jest.fn();

    render(
      <ChatRoomList
        rooms={rooms}
        selectedRoomId="room-1"
        onSelectRoom={handleSelect}
        onRefresh={handleRefresh}
        onCreateRoom={handleCreate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /refresh rooms/i }));
    expect(handleRefresh).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /create room/i }));
    expect(handleCreate).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Coffee Shop'));
    expect(handleSelect).toHaveBeenCalledWith('room-2');
  });

  it('displays empty and error states', () => {
    const { rerender } = render(<ChatRoomList rooms={[]} isRefreshing />);
    expect(screen.getByText(/Loading rooms/)).toBeInTheDocument();

    rerender(<ChatRoomList rooms={[]} error="failed to load" />);
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });
});
