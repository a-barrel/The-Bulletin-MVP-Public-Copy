import React from 'react';
import { render, screen } from '@testing-library/react';
import ProtectedRoute from '../../src/components/ProtectedRoute';
import { useAuthState } from 'react-firebase-hooks/auth';

jest.mock('../../src/firebase', () => ({ auth: {} }));
jest.mock('react-firebase-hooks/auth', () => ({
  useAuthState: jest.fn()
}));
jest.mock('react-router-dom', () => ({
  Navigate: ({ to }) => <div data-testid="navigate">{to}</div>
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthState.mockReset();
  });

  it('renders a loading indicator while auth state resolves', () => {
    useAuthState.mockReturnValue([null, true]);

    render(
      <ProtectedRoute>
        <div>Private</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('redirects unauthenticated visitors to the login page', () => {
    useAuthState.mockReturnValue([null, false]);

    render(
      <ProtectedRoute>
        <div>Private</div>
      </ProtectedRoute>
    );

    expect(screen.getByTestId('navigate')).toHaveTextContent('/login');
  });

  it('renders child content when a user is authenticated', () => {
    useAuthState.mockReturnValue([{ uid: 'user-123' }, false]);

    render(
      <ProtectedRoute>
        <div>Private Section</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Private Section')).toBeInTheDocument();
  });
});
