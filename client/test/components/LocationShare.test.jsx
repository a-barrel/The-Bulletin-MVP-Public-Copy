import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

jest.mock('@mui/material', () => ({
  Box: ({ children, ...rest }) => <div {...rest}>{children}</div>,
  Typography: ({ children, ...rest }) => <span {...rest}>{children}</span>,
  Switch: ({ onChange, checked = false, ...rest }) => (
    <input
      type="checkbox"
      aria-label="toggle"
      checked={checked}
      onChange={(event) => onChange?.({ target: { checked: event.target.checked } })}
      {...rest}
    />
  ),
  FormControlLabel: ({ control, label, ...rest }) => (
    <label {...rest}>
      {control}
      {typeof label === 'string' ? <span>{label}</span> : label}
    </label>
  )
}));

import LocationShare from '../../src/components/LocationShare';

describe('LocationShare', () => {
  it('shows helper text when provided', () => {
    render(<LocationShare isSharing={false} onToggle={jest.fn()} helperText="Test helper" />);

    expect(screen.getByText('Test helper')).toBeInTheDocument();
  });

  it('invokes onToggle when the switch is clicked', () => {
    const handleToggle = jest.fn();
    render(<LocationShare isSharing={false} onToggle={handleToggle} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'toggle' }));
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });
});
