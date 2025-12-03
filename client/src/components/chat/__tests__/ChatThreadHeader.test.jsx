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
  it('renders title and triggers back navigation', () => {
    const handleBack = jest.fn();

    render(
      <ChatThreadHeader
        pageTitle="Chat"
        backAriaLabel="Back"
        onBack={handleBack}
        onCreatePin={jest.fn()}
        onNotifications={jest.fn()}
      />
    );

    expect(screen.getByText('Chat')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/back/i));
    expect(handleBack).toHaveBeenCalledTimes(1);
  });

  it('renders the global navigation trigger', () => {
    render(
      <ChatThreadHeader
        pageTitle="Chat"
        backAriaLabel="Back"
        onBack={jest.fn()}
        onCreatePin={jest.fn()}
        onNotifications={jest.fn()}
      />
    );

    expect(screen.getByTestId('global-nav')).toBeInTheDocument();
  });

  it('disables notifications when offline', () => {
    render(
      <ChatThreadHeader
        pageTitle="Chat"
        backAriaLabel="Back"
        onBack={jest.fn()}
        onCreatePin={jest.fn()}
        onNotifications={jest.fn()}
        notificationsLabel="Notifications"
        isOffline
      />
    );

    expect(screen.getByRole('button', { name: /notifications/i })).toBeDisabled();
  });
});
