import { fireEvent, render, screen } from '@testing-library/react';
import UpdatesTabs from '../../src/components/updates/UpdatesTabs.jsx';

describe('UpdatesTabs', () => {
  it('calls onSelect when a tab is clicked', () => {
    const handleSelect = jest.fn();
    render(
      <UpdatesTabs
        tabs={[
          { label: 'All', count: 2 },
          { label: 'Events', count: 1 },
          { label: 'Time', count: 0 }
        ]}
        selected="All"
        onSelect={handleSelect}
        ariaLabel="Primary updates"
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Events/i }));
    expect(handleSelect).toHaveBeenCalledWith('Events');
  });

  it('sets aria-selected on the active tab', () => {
    render(
      <UpdatesTabs
        tabs={[
          { label: 'All', count: 0 },
          { label: 'Discussions', count: 0 }
        ]}
        selected="Discussions"
        onSelect={() => {}}
        ariaLabel="Primary updates"
      />
    );

    const activeTab = screen.getByRole('tab', { name: /Discussions/i });
    expect(activeTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /All/i })).toHaveAttribute('aria-selected', 'false');
  });
});
