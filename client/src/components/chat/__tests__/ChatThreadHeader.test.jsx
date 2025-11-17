import { fireEvent, render, screen } from '@testing-library/react';
import ChatThreadHeader from '../ChatThreadHeader';

jest.mock('../../GlobalNavMenu', () => {
  const MockGlobalNavMenu = (props) => (
    <div data-testid="global-nav" {...props}>
      nav
    </div>
  );
  MockGlobalNavMenu.displayName = 'MockGlobalNavMenu';
  return MockGlobalNavMenu;
});

describe('ChatThreadHeader', () => {
  it('renders channel label and triggers callbacks', () => {
    const handleOpen = jest.fn();
    const handleNotifications = jest.fn();

    render(
      <ChatThreadHeader
        channelLabel="Direct messages"
        isChannelDialogOpen
        notificationsLabel="Notifications"
        onNotifications={handleNotifications}
        onOpenChannelDialog={handleOpen}
        updatesIconSrc="icon.svg"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /direct messages/i }));
    expect(handleOpen).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(handleNotifications).toHaveBeenCalledTimes(1);
  });

  it('disables notifications button when offline', () => {
    render(
      <ChatThreadHeader
        channelLabel="Rooms"
        notificationsLabel="Notifications"
        onNotifications={jest.fn()}
        onOpenChannelDialog={jest.fn()}
        isOffline
        updatesIconSrc="icon.svg"
      />
    );

    expect(screen.getByRole('button', { name: /notifications/i })).toBeDisabled();
  });
});
