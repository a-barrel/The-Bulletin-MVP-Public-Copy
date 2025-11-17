import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export default function useScrollToLatestMessage({
  activeChannel,
  roomDependency,
  directDependency,
  roomMessageCount,
  directMessageCount,
  locationKey
}) {
  const containerRef = useRef(null);
  const inputContainerRef = useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [scrollButtonOffset, setScrollButtonOffset] = useState(0);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    });
  }, []);

  useLayoutEffect(() => {
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [directDependency, locationKey, roomDependency, scrollToBottom]);

  useEffect(() => {
    if (activeChannel === 'rooms' && roomMessageCount > 0) {
      const timer = setTimeout(scrollToBottom, 75);
      return () => clearTimeout(timer);
    }
    if (activeChannel === 'direct' && directMessageCount > 0) {
      const timer = setTimeout(scrollToBottom, 75);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [activeChannel, directMessageCount, roomMessageCount, scrollToBottom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const handleScroll = () => {
      const node = containerRef.current;
      if (!node) {
        return;
      }
      const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
      setShowScrollButton(distanceFromBottom > 20);
    };
    container.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const inputContainer = inputContainerRef.current;
    if (!inputContainer) {
      return undefined;
    }

    const scheduleFrame =
      typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame
        : (callback) => setTimeout(callback, 16);
    const cancelFrame =
      typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function'
        ? window.cancelAnimationFrame
        : (id) => clearTimeout(id);

    let frameId = null;
    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }
      const targetBottom = Math.round(entry.contentRect.height) + 8;
      if (frameId !== null) {
        cancelFrame(frameId);
      }
      frameId = scheduleFrame(() => {
        setScrollButtonOffset((prev) =>
          Math.abs(prev - targetBottom) > 0.5 ? targetBottom : prev
        );
      });
    });

    resizeObserver.observe(inputContainer);

    return () => {
      if (frameId !== null) {
        cancelFrame(frameId);
      }
      resizeObserver.disconnect();
    };
  }, []);

  return {
    containerRef,
    inputContainerRef,
    showScrollButton,
    scrollButtonOffset,
    scrollToBottom
  };
}
