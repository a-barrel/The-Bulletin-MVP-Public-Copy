import { render, screen } from '@testing-library/react';
import EmulationTestPage from '../../src/pages/EmulationTest';
import useAutoplayAudio from '../../src/hooks/useAutoplayAudio';
import useBadgeAwardOnEntry from '../../src/hooks/useBadgeAwardOnEntry';

jest.mock('../../src/hooks/useAutoplayAudio', () => {
  const React = require('react');
  return jest.fn(() => React.createRef());
});

jest.mock('../../src/hooks/useBadgeAwardOnEntry', () => jest.fn());

describe('EmulationTestPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the emulation assets and hooks', () => {
    const reportClientError = require('../../src/utils/reportClientError');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(<EmulationTestPage />);

    expect(screen.getByAltText('Engineer animation')).toBeInTheDocument();
    expect(screen.getByAltText('Engineer animation mirrored')).toBeInTheDocument();

    const audio = container.querySelector('audio');
    expect(audio).toBeInTheDocument();
    expect(audio).toHaveAttribute('loop');

    expect(useBadgeAwardOnEntry).toHaveBeenCalledWith('how-badge');
    expect(useAutoplayAudio).toHaveBeenCalledWith({ volume: 0.75 });

    jest.restoreAllMocks();
    reportClientError.mockClear?.();
  });
});
