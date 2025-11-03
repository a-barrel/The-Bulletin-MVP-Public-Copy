import { fireEvent, render, screen } from '@testing-library/react';
import DirectThreadList from '../DirectThreadList';

const baseThreads = [
  {
    id: 'thread-1',
    participants: [
      {
        _id: 'user-a',
        displayName: 'Alex'
      },
      {
        _id: 'viewer',
        displayName: 'Viewer'
      }
    ],
    lastMessageAt: new Date('2024-02-10T10:00:00Z').toISOString(),
    messageCount: 3
  },
  {
    id: 'thread-2',
    participants: [
      {
        _id: 'user-b',
        displayName: 'Bailey'
      }
    ],
    messageCount: 0
  }
];

describe('DirectThreadList', () => {
  it('shows access warning when direct messages are disabled', () => {
    render(
      <DirectThreadList
        threads={baseThreads}
        onSelectThread={jest.fn()}
        canAccess={false}
      />
    );

    expect(
      screen.getByText(/Direct messages are disabled for your account/i)
    ).toBeInTheDocument();
  });

  it('renders thread entries and fires selection callback', () => {
    const handleSelect = jest.fn();

    render(
      <DirectThreadList
        threads={baseThreads}
        selectedThreadId="thread-1"
        onSelectThread={handleSelect}
        viewerId="viewer"
      />
    );

    const threadRow = screen.getByText('Bailey').closest('[role="button"]');
    expect(threadRow).toBeTruthy();
    fireEvent.click(threadRow);

    expect(handleSelect).toHaveBeenCalledWith('thread-2');
    expect(screen.getByText('Direct messages')).toBeInTheDocument();
  });

  it('renders empty-state helper when no conversations exist', () => {
    render(
      <DirectThreadList threads={[]} onSelectThread={jest.fn()} isLoading={false} />
    );

    expect(
      screen.getByText(/You have no conversations yet/i)
    ).toBeInTheDocument();
  });

  it('displays a loading indicator while refresh is in progress', () => {
    render(
      <DirectThreadList
        threads={baseThreads}
        onSelectThread={jest.fn()}
        isLoading
        onRefresh={jest.fn()}
      />
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
