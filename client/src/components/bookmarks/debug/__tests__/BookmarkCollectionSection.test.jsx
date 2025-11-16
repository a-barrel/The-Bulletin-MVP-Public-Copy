import { fireEvent, render, screen } from '@testing-library/react';
import BookmarkCollectionSection from '../BookmarkCollectionSection';

jest.mock('../../../PinCard', () => function MockPinCard({ item, onSelectItem }) {
  return (
    <div data-testid="pin-card" onClick={() => onSelectItem(item?.id)}>
      {item?.title || 'Pin'}
    </div>
  );
});

const baseBookmark = {
  _id: 'bookmark-1',
  pinId: 'pin-1',
  pin: {
    _id: 'pin-1',
    title: 'Test Pin',
    creator: { displayName: 'Creator' }
  },
  createdAt: '2025-11-15T10:00:00.000Z'
};

const baseProps = {
  group: { id: 'collection-1', name: 'My Collection', items: [baseBookmark] },
  viewerProfileId: 'viewer-1',
  removingPinId: null,
  isOffline: false,
  formatSavedDate: () => 'Nov 15, 2025',
  onViewPin: jest.fn(),
  onViewAuthor: jest.fn(),
  onRemoveBookmark: jest.fn(),
  isHighlighted: false,
  isPinned: true,
  onPinToggle: jest.fn(),
  registerAnchor: jest.fn()
};

describe('BookmarkCollectionSection', () => {
  it('renders collection details and pin content', () => {
    render(<BookmarkCollectionSection {...baseProps} />);

    expect(screen.getByText('My Collection')).toBeInTheDocument();
    expect(screen.getByTestId('pin-card')).toBeInTheDocument();
    expect(screen.getByText('Saved on Nov 15, 2025')).toBeInTheDocument();
  });

  it('calls onPinToggle when toggling pinned state', () => {
    const onPinToggle = jest.fn();
    render(<BookmarkCollectionSection {...baseProps} isPinned={false} onPinToggle={onPinToggle} />);

    fireEvent.click(screen.getByRole('button', { name: /pin to quick nav/i }));
    expect(onPinToggle).toHaveBeenCalledWith(true);
  });
});
