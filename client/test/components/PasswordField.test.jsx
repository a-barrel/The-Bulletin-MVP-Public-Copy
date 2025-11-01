import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import PasswordField from '../../src/components/PasswordField.jsx';

function PasswordFieldHarness({ error }) {
  const [value, setValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <PasswordField
      value={value}
      onChange={(event) => setValue(event.target.value)}
      showPassword={showPassword}
      onToggleVisibility={() => setShowPassword((prev) => !prev)}
      error={error}
      placeholder="Enter password"
    />
  );
}

describe('PasswordField', () => {
  it('toggles password visibility', () => {
    render(<PasswordFieldHarness error="" />);

    const input = screen.getByPlaceholderText('Enter password');
    const toggleButton = screen.getByRole('button', { name: /show password/i });

    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(toggleButton);

    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();
  });

  it('renders error text', () => {
    render(<PasswordFieldHarness error="Error: Empty Password" />);

    expect(screen.getByText('Error: Empty Password')).toBeInTheDocument();
  });
});
