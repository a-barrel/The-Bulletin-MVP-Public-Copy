import { fireEvent, render, screen } from '@testing-library/react';
import ChatModerationDialog from '../ChatModerationDialog';

describe('ChatModerationDialog', () => {
  it('renders context and quick actions', () => {
    const handleSelect = jest.fn();
    const handleFieldChange = jest.fn(() => () => {});

    render(
      <ChatModerationDialog
        open
        context={{ displayName: 'Casey', messagePreview: 'Example' }}
        hasAccess
        actionStatus={{ type: 'success', message: 'ok' }}
        form={{ type: 'warn', reason: '', durationMinutes: '15' }}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        onFieldChange={handleFieldChange}
        onSelectQuickAction={handleSelect}
        disableSubmit
        isSubmitting={false}
      />
    );

    expect(screen.getByText(/Moderate Casey/)).toBeInTheDocument();
    const quickChip = screen.getAllByRole('button', { name: /Warn user/i })[0];
    fireEvent.click(quickChip);
    expect(handleSelect).toHaveBeenCalledWith('warn');
    expect(screen.getByRole('button', { name: /apply action/i })).toBeDisabled();
  });
});
