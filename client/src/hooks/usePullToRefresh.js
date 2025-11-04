import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Lightweight pull-to-refresh helper for touch devices.
 * Exposes a container ref to attach to the scrollable element along with
 * the current pull distance and refresh state for UI feedback.
 */
export default function usePullToRefresh(refreshFn) {
  const containerRef = useRef(null);
  const pendingRefreshRef = useRef(false);

  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const triggerRefresh = useCallback(() => {
    if (pendingRefreshRef.current) {
      return;
    }

    pendingRefreshRef.current = true;
    setIsPullRefreshing(true);

    const maybePromise = typeof refreshFn === 'function' ? refreshFn({ silent: true }) : null;
    Promise.resolve(maybePromise)
      .catch(() => {
        // errors surface through the caller's state management
      })
      .finally(() => {
        setTimeout(() => {
          setIsPullRefreshing(false);
          setPullDistance(0);
          pendingRefreshRef.current = false;
        }, 400);
      });
  }, [refreshFn]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return undefined;
    }

    let startY = 0;
    let pulling = false;

    const onTouchStart = (event) => {
      if (el.scrollTop <= 4 && !isPullRefreshing) {
        startY = event.touches[0]?.clientY ?? 0;
        pulling = true;
      }
    };

    const onTouchMove = (event) => {
      if (!pulling) {
        return;
      }
      const currentY = event.touches[0]?.clientY ?? startY;
      const delta = currentY - startY;
      if (delta > 0) {
        setPullDistance(Math.min(delta, 72));
      }

      if (delta > 60 && !pendingRefreshRef.current && !isPullRefreshing) {
        pulling = false;
        triggerRefresh();
      }
    };

    const onTouchEnd = () => {
      pulling = false;
      if (!isPullRefreshing) {
        setPullDistance(0);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [isPullRefreshing, triggerRefresh]);

  return { containerRef, pullDistance, isPullRefreshing };
}
