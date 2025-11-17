import { act, renderHook } from '@testing-library/react';
import useBookmarkQuickNavPrefs, {
  QUICK_NAV_STORAGE_KEY
} from '../useBookmarkQuickNavPrefs';

describe('useBookmarkQuickNavPrefs', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('loads existing preferences from storage', () => {
    window.localStorage.setItem(
      QUICK_NAV_STORAGE_KEY,
      JSON.stringify({ version: 1, hidden: ['collection-1'] })
    );

    const { result } = renderHook(() => useBookmarkQuickNavPrefs());

    expect(result.current.hiddenKeys).toContain('collection-1');
  });

  it('persists visibility changes and emits an event', () => {
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
    const { result } = renderHook(() => useBookmarkQuickNavPrefs());

    act(() => {
      result.current.setCollectionPinned('collection-2', false);
    });

    expect(result.current.hiddenKeys).toContain('collection-2');
    const stored = JSON.parse(window.localStorage.getItem(QUICK_NAV_STORAGE_KEY));
    expect(stored.hidden).toContain('collection-2');
    expect(dispatchSpy).toHaveBeenCalled();
  });

  it('highlights a collection and clears after the timeout', () => {
    const { result } = renderHook(() => useBookmarkQuickNavPrefs());

    act(() => {
      result.current.highlightCollection('collection-3', 500);
    });

    expect(result.current.highlightedKey).toBe('collection-3');

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.highlightedKey).toBeNull();
  });
});
