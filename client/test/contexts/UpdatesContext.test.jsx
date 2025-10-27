import React from 'react';
import { render } from '@testing-library/react';
import UpdatesContext, { UpdatesProvider } from '../../src/contexts/UpdatesContext';

describe('UpdatesContext', () => {
  it('provides unread count to consumers', () => {
    let observed;
    render(
      <UpdatesProvider value={{ unreadCount: 5, setUnreadCount: jest.fn() }}>
        <UpdatesContext.Consumer>
          {(value) => {
            observed = value;
            return null;
          }}
        </UpdatesContext.Consumer>
      </UpdatesProvider>
    );

    expect(observed.unreadCount).toBe(5);
  });

  it('exposes setter function through context', () => {
    const setUnreadCount = jest.fn();
    let observed;
    render(
      <UpdatesProvider value={{ unreadCount: 0, setUnreadCount }}>
        <UpdatesContext.Consumer>
          {(value) => {
            observed = value;
            return null;
          }}
        </UpdatesContext.Consumer>
      </UpdatesProvider>
    );

    observed.setUnreadCount(3);
    expect(setUnreadCount).toHaveBeenCalledWith(3);
  });
});
