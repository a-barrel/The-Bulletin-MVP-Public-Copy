import { render, screen } from '@testing-library/react';
import SelectableLocationMap from '../SelectableLocationMap';

jest.mock('leaflet', () => ({
  divIcon: jest.fn(() => ({ icon: true })),
  Icon: {
    Default: {
      prototype: { _getIconUrl: null },
      mergeOptions: jest.fn()
    }
  }
}));

jest.mock('react-leaflet', () => {
  const React = require('react');
  const handlers = { current: null };
  const mapInstance = { setView: jest.fn() };
  const MapContext = React.createContext(mapInstance);
  const MapProvider = ({ children }) => (
    <MapContext.Provider value={mapInstance}>{children}</MapContext.Provider>
  );

  const Marker = ({ position, icon }) => (
    <div data-testid="marker" data-position={JSON.stringify(position)} data-icon={icon ? 'true' : 'false'} />
  );

  const Polyline = ({ positions }) => (
    <div data-testid="polyline" data-positions={JSON.stringify(positions)} />
  );

  return {
    __esModule: true,
    MapContainer: ({ children }) => <div data-testid="map-container"><MapProvider>{children}</MapProvider></div>,
    TileLayer: () => <div data-testid="tile-layer" />,
    Marker,
    Polyline,
    useMap: () => mapInstance,
    useMapEvents: (events) => {
      handlers.current = events;
      return null;
    },
    __handlers: handlers,
    __mockMap: mapInstance
  };
});

const { __handlers, __mockMap } = require('react-leaflet');

const triggerMapClick = (lat, lng) => {
  if (__handlers.current?.click) {
    __handlers.current.click({ latlng: { lat, lng } });
  }
};

describe('SelectableLocationMap', () => {
  beforeEach(() => {
    __mockMap.setView.mockClear();
  });

  it('renders viewer and draft markers when coordinates exist', () => {
    render(
      <SelectableLocationMap
        value={{ lat: 34, lng: -118 }}
        anchor={{ lat: 33, lng: -118.1 }}
        viewerName="Viewer"
        avatarUrl="/avatar.png"
      />
    );
    const markers = screen.getAllByTestId('marker');
    expect(markers).toHaveLength(2);
    expect(__mockMap.setView).toHaveBeenCalledWith([34, -118]);
    expect(screen.getByTestId('polyline')).toBeInTheDocument();
  });

  it('fires onChange when map is clicked', () => {
    const handleChange = jest.fn();
    render(<SelectableLocationMap value={null} onChange={handleChange} anchor={null} viewerName="Viewer" />);
    triggerMapClick(10, 20);
    expect(handleChange).toHaveBeenCalledWith({ lat: 10, lng: 20 });
  });
});
