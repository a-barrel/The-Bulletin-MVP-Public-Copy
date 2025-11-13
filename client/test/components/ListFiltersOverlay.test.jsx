import { fireEvent, render, screen } from '@testing-library/react';
import ListFiltersOverlay from '../../src/components/ListFiltersOverlay';

const defaultFilters = {
  search: '',
  status: 'active',
  startDate: '',
  endDate: '',
  types: [],
  categories: [],
  friendEngagements: []
};

const initialFilters = {
  search: 'music',
  status: 'active',
  startDate: '2025-01-01',
  endDate: '2025-01-02',
  types: ['event'],
  categories: ['Community'],
  friendEngagements: []
};

const renderOverlay = (props = {}) =>
  render(
    <ListFiltersOverlay
      open
      onClose={jest.fn()}
      onApply={jest.fn()}
      onClear={jest.fn()}
      defaultFilters={defaultFilters}
      initialFilters={initialFilters}
      categories={[
        { name: 'Community', count: 4 },
        { name: 'Outdoors', count: 2 }
      ]}
      {...props}
    />
  );

describe('ListFiltersOverlay', () => {
  it('applies normalized filters on submit', () => {
    const onApply = jest.fn();
    const onClose = jest.fn();

    renderOverlay({ onApply, onClose });

    fireEvent.change(screen.getByPlaceholderText(/titles, descriptions/i), {
      target: { value: '  Beach cleanup ' }
    });

    fireEvent.click(screen.getByLabelText('Events'));
    fireEvent.click(screen.getByLabelText('Discussions'));
    fireEvent.click(screen.getByText(/outdoors/i));

    const startDate = screen.getByLabelText('Start date');
    const endDate = screen.getByLabelText('End date');
    fireEvent.change(startDate, { target: { value: '2025-03-01' } });
    fireEvent.change(endDate, { target: { value: '2025-03-15' } });

    const addInput = screen.getByLabelText(/add category/i);
    fireEvent.change(addInput, { target: { value: '  Community ' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    fireEvent.click(screen.getByLabelText('Expired'));

    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));

    expect(onApply).toHaveBeenCalledWith({
      search: '  Beach cleanup ',
      status: 'expired',
      startDate: '2025-03-01',
      endDate: '2025-03-15',
      types: ['discussion'],
      categories: ['Community', 'Outdoors'],
      friendEngagements: []
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('clears filters and invokes onClear', () => {
    const onClear = jest.fn();

    renderOverlay({ onClear });

    fireEvent.change(screen.getByPlaceholderText(/titles, descriptions/i), {
      target: { value: 'something' }
    });

    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }));

    expect(onClear).toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/titles, descriptions/i)).toHaveValue('');
    expect(screen.getByLabelText('Start date')).toHaveValue('');
    expect(screen.getByLabelText('End date')).toHaveValue('');
  });

  it('triggers refresh handler and surfaces errors', () => {
    const onRefreshCategories = jest.fn();

    renderOverlay({
      onRefreshCategories,
      categoryError: 'Unable to load categories.'
    });

    fireEvent.click(screen.getByRole('button', { name: /refresh categories/i }));
    expect(onRefreshCategories).toHaveBeenCalled();

    expect(screen.getByText(/unable to load categories/i)).toBeInTheDocument();
  });
});
