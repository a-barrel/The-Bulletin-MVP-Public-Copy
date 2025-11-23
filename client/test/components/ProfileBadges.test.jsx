import { render, screen, fireEvent } from '@testing-library/react';
import ProfileBadges from '../../src/components/profile/ProfileBadges.jsx';

describe('ProfileBadges', () => {
  it('uses placeholder when badge image missing', () => {
    render(<ProfileBadges badgeList={['unknown-badge']} />);
    const avatarImg = screen.getByAltText(/unknown-badge badge/i);
    expect(avatarImg.getAttribute('src')).toContain('svg-mock');
  });

  it('falls back to placeholder when badge image fails to load', () => {
    render(<ProfileBadges badgeList={['enter-debug-console']} />);
    const avatarImg = screen.getByAltText(/Debugger badge/i);
    expect(avatarImg.getAttribute('src')).toContain('enter_debug_console_first_time_badge');
    fireEvent.error(avatarImg);
    expect(avatarImg.getAttribute('src')).toContain('svg-mock');
  });

  it('renders provided badge images when valid', () => {
    render(<ProfileBadges badgeList={['chat-first-message']} />);
    const avatarImg = screen.getByAltText(/Conversation Starter badge/i);
    expect(avatarImg.getAttribute('src')).toContain('chat_first_time_badge');
  });
});
