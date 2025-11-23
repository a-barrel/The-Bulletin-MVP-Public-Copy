import { render, screen } from '@testing-library/react';
import ChatRoomList from '../../src/components/chat/ChatRoomList.jsx';

describe('ChatRoomList', () => {
  it('does not render a create button', () => {
    render(
      <ChatRoomList
        rooms={[{ _id: 'room-1', name: 'Room 1', participantCount: 2, isGlobal: false }]}
        selectedRoomId="room-1"
        onSelectRoom={() => {}}
      />
    );

    expect(screen.queryByLabelText(/create room/i)).not.toBeInTheDocument();
  });

  it('shows empty state without suggesting creation', () => {
    render(<ChatRoomList rooms={[]} onSelectRoom={() => {}} />);
    expect(screen.getByText(/No rooms yet./i)).toBeInTheDocument();
  });
});
