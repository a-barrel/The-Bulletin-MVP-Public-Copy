import { render, screen } from '@testing-library/react';
import PinPreviewCard from '../../src/components/PinPreviewCard';

describe('PinPreviewCard', () => {
  it('renders key metadata and stats', () => {
    render(
      <PinPreviewCard
        pin={{
          _id: 'pin-123',
          title: 'Test Event',
          type: 'event',
          bookmarkCount: 5,
          replyCount: 2,
          participantCount: 10,
          participantLimit: 20,
          creator: { username: 'host', avatarUrl: '/avatar.png' },
          description: 'A fun time.',
          addressPrecise: '123 Main St, Springfield',
          startDate: '2025-12-01T10:00:00Z',
          endDate: '2025-12-01T12:00:00Z',
          tags: ['food', 'community'],
          coverPhoto: { url: '/cover.jpg' }
        }}
        distanceMiles={1.5}
        coordinateLabel="33.1, -118.2"
        proximityRadiusMeters={1000}
      />
    );

    expect(screen.getByText('Test Event')).toBeInTheDocument();
    expect(screen.queryByText(/ID:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Distance/)).toBeInTheDocument();
    expect(screen.getByText(/Attending/)).toBeInTheDocument();
    expect(screen.getByText(/Bookmarks/)).toBeInTheDocument();
    expect(screen.getByText(/Replies/)).toBeInTheDocument();
    expect(screen.getByText(/123 Main St/)).toBeInTheDocument();
    expect(screen.getByText(/Dec/)).toBeInTheDocument();
    expect(screen.getByText(/food/)).toBeInTheDocument();
    expect(screen.getByText(/community/)).toBeInTheDocument();
    expect(screen.getByText(/A fun time/)).toBeInTheDocument();
    expect(screen.getByAltText("host's avatar")).toBeInTheDocument();
    expect(document.querySelector('.pin-preview-card__media img')).toBeTruthy();
  });

  it('handles missing optional fields gracefully', () => {
    render(
      <PinPreviewCard
        pin={{
          _id: 'pin-456',
          title: 'Draft Pin',
          type: 'discussion',
          description: '',
          creator: { username: 'drafty' }
        }}
      />
    );

    expect(screen.getByText('Draft Pin')).toBeInTheDocument();
    expect(screen.queryByText(/ID:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Distance/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Attending/)).not.toBeInTheDocument();
    expect(screen.getByText(/Discussion/)).toBeInTheDocument();
    expect(screen.getByText(/No photo yet/)).toBeInTheDocument();
  });
});
