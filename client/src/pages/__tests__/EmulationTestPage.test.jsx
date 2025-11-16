import { render, screen } from '@testing-library/react';
import EmulationTestPage from '../EmulationTest';
import useAutoplayAudio from '../../hooks/useAutoplayAudio';
import useBadgeAwardOnEntry from '../../hooks/useBadgeAwardOnEntry';

jest.mock('../../hooks/useAutoplayAudio', () => {
  const React = require('react');
  return jest.fn(() => React.createRef());
});

jest.mock('../../hooks/useBadgeAwardOnEntry', () => jest.fn());

describe('EmulationTestPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the emulation assets and hooks', () => {
    const { container } = render(<EmulationTestPage />);

    expect(screen.getByAltText('Engineer animation')).toBeInTheDocument();
    expect(screen.getByAltText('Engineer animation mirrored')).toBeInTheDocument();

    const audio = container.querySelector('audio');
    expect(audio).toBeInTheDocument();
    expect(audio).toHaveAttribute('loop');

    expect(useBadgeAwardOnEntry).toHaveBeenCalledWith('how-badge');
    expect(useAutoplayAudio).toHaveBeenCalledWith({ volume: 0.75 });
  });
});
