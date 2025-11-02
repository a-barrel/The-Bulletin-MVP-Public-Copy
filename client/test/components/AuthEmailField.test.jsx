import { render, screen } from '@testing-library/react';
import AuthEmailField, { validateAuthEmail } from '../../src/components/AuthEmailField.jsx';

describe('AuthEmailField', () => {
  it('renders email input with expected attributes', () => {
    render(<AuthEmailField value="" onChange={() => {}} placeholder="Enter Email" />);

    const input = screen.getByPlaceholderText('Enter Email');

    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('inputmode', 'email');
  });

  it('normalizes mixed-case enter email placeholder to title case', () => {
    render(<AuthEmailField value="" onChange={() => {}} placeholder="Enter email" />);

    expect(screen.getByPlaceholderText('Enter Email')).toBeInTheDocument();
  });

  it('displays error text when provided', () => {
    render(
      <AuthEmailField
        value="user@example.com"
        onChange={() => {}}
        error="Please enter a valid email address."
        placeholder="Enter Email"
      />
    );

    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
  });

  it('validateAuthEmail helper returns expected messages', () => {
    expect(validateAuthEmail('')).toBe('Please enter an email address.');
    expect(validateAuthEmail('invalid-email')).toBe('Please enter a valid email address.');
    expect(validateAuthEmail('user@example.com')).toBe('');
  });
});
