import React from 'react';
import { render } from '@testing-library/react';
import Feed from '../../src/components/Feed';

jest.mock('../../src/components/PinCard', () => {
  const React = require('react');
  const MockPinCard = jest.fn(({ item }) => (
    <div data-testid={`card-${item?.id || item?._id}`} />
  ));
  MockPinCard.displayName = 'PinCard';
  return { __esModule: true, default: MockPinCard };
});

const PinCard = require('../../src/components/PinCard').default;

describe('Feed memoization', () => {
  beforeEach(() => {
    PinCard.mockClear();
  });

  it('does not rerender cards when props are unchanged', () => {
    const items = [{ id: '1' }, { id: '2' }];
    const handleItem = () => {};
    const handleAuthor = () => {};

    const { rerender } = render(
      <Feed items={items} onSelectItem={handleItem} onSelectAuthor={handleAuthor} />
    );

    expect(PinCard).toHaveBeenCalledTimes(2);

    rerender(<Feed items={items} onSelectItem={handleItem} onSelectAuthor={handleAuthor} />);
    expect(PinCard).toHaveBeenCalledTimes(2);

    const nextItems = [...items];
    rerender(<Feed items={nextItems} onSelectItem={handleItem} onSelectAuthor={handleAuthor} />);
    expect(PinCard).toHaveBeenCalledTimes(4);
  });
});
