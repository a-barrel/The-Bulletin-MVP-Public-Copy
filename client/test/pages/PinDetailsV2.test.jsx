import React from 'react';
import { render, screen } from '@testing-library/react';
import PinDetailsV2WIP, { pageConfig } from '../../src/pages/_v2_WIP_PinDetails';
import { fetchPinById, fetchReplies } from '../../src/api/mongoDataApi';
import { useParams } from 'react-router-dom';

jest.mock('../../src/config/runtime', () => ({
  __esModule: true,
  default: {
    apiBaseUrl: 'https://example.com',
    isOffline: true,
    isOnline: false,
    firebase: { config: {}, authEmulatorUrl: undefined }
  }
}));

jest.mock('../../src/components/Map', () => ({
  __esModule: true,
  default: () => <div data-testid="map-placeholder" />
}));

jest.mock('../../src/api/mongoDataApi', () => ({
  __esModule: true,
  fetchPinById: jest.fn(),
  fetchReplies: jest.fn()
}));

jest.mock('react-router-dom', () => ({
  useParams: jest.fn(),
  Link: ({ to, children, ...props }) => (
    <a data-testid={`link-${to}`} {...props}>
      {children}
    </a>
  )
}));

describe('PinDetailsV2 pageConfig.resolveNavTarget', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the current path when navigation prompt is cancelled', () => {
    jest.spyOn(window, 'prompt').mockReturnValue(null);
    expect(pageConfig.resolveNavTarget({ currentPath: '/pin-v2/existing' })).toBe('/pin-v2/existing');
  });

  it('routes to the expired pin preview when "expired" is entered', () => {
    jest.spyOn(window, 'prompt').mockReturnValue('expired');
    expect(pageConfig.resolveNavTarget()).toBe('/pin-v2/68e061721329566a22d47fff');
  });

  it('selects a sample pin id when the prompt is blank', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    jest.spyOn(window, 'prompt').mockReturnValue('   ');
    expect(pageConfig.resolveNavTarget()).toBe('/pin-v2/68e061721329566a22d474ab');
  });

  it('targets a custom pin id when provided', () => {
    jest.spyOn(window, 'prompt').mockReturnValue('custom-pin');
    expect(pageConfig.resolveNavTarget()).toBe('/pin-v2/custom-pin');
  });
});

describe('PinDetailsV2WIP page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows fallback messaging when pin data lacks coordinates and replies', async () => {
    fetchPinById.mockResolvedValue({
      _id: 'pin-fallback',
      title: 'Fallback Pin',
      description: 'Preview without coordinates',
      type: 'pin',
      tags: [],
      relatedPinIds: [],
      creator: {}
    });
    fetchReplies.mockResolvedValue([]);
    useParams.mockReturnValue({ pinId: 'pin-fallback' });

    render(<PinDetailsV2WIP />);

    expect(await screen.findByText('Fallback Pin')).toBeInTheDocument();
    expect(await screen.findByText('No map coordinates available for this pin.')).toBeInTheDocument();
    expect(await screen.findByText('No replies yet.')).toBeInTheDocument();
    expect(fetchPinById).toHaveBeenCalledWith(
      'pin-fallback',
      expect.objectContaining({ signal: expect.any(Object) })
    );
    expect(fetchReplies).toHaveBeenCalledWith(
      'pin-fallback',
      expect.objectContaining({ signal: expect.any(Object) })
    );
    expect(screen.queryByTestId('map-placeholder')).not.toBeInTheDocument();
  });

  it('renders pin metadata, replies, and map details when data is available', async () => {
    fetchPinById.mockResolvedValue({
      _id: 'pin-success',
      title: 'Community Cleanup',
      description: 'Help tidy the park this weekend.',
      type: 'event',
      tags: ['cleanup', 'community'],
      relatedPinIds: ['pin-123'],
      address: { precise: '123 Main St', city: 'Springfield' },
      coordinates: { coordinates: [-118.15, 33.81] },
      coverPhoto: { url: '/images/sample-cover.jpg' },
      creator: {
        displayName: 'Alex',
        username: 'alex123',
        avatar: { url: '/images/avatars/alex.jpg' }
      },
      bookmarkCount: 4,
      participantCount: 2,
      participantLimit: 10,
      startDate: '2025-10-30T18:00:00Z',
      endDate: '2025-10-30T20:00:00Z'
    });
    fetchReplies.mockResolvedValue([
      {
        _id: 'reply-1',
        message: 'Looking forward to it!',
        createdAt: '2025-10-22T18:00:00Z',
        author: { displayName: 'Jordan', avatar: { url: '/avatars/jordan.png' } }
      }
    ]);
    useParams.mockReturnValue({ pinId: 'pin-success' });

    render(<PinDetailsV2WIP />);

    expect(await screen.findByText('Community Cleanup')).toBeInTheDocument();
    expect(fetchPinById).toHaveBeenCalledWith(
      'pin-success',
      expect.objectContaining({ signal: expect.any(Object) })
    );
    expect(fetchReplies).toHaveBeenCalledWith(
      'pin-success',
      expect.objectContaining({ signal: expect.any(Object) })
    );
    expect(screen.getByTestId('map-placeholder')).toBeInTheDocument();
    expect(screen.getByText('Looking forward to it!')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
  });
});
