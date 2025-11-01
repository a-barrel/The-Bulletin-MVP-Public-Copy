import { useCallback, useEffect, useRef, useState } from 'react';

const useShake = (duration = 300) => {
  const [isShaking, setIsShaking] = useState(false);
  const timerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const triggerShake = useCallback(() => {
    setIsShaking(true);
    clearTimer();
    timerRef.current = setTimeout(() => {
      setIsShaking(false);
      timerRef.current = null;
    }, duration);
  }, [clearTimer, duration]);

  const cancelShake = useCallback(() => {
    clearTimer();
    setIsShaking(false);
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  return {
    shake: isShaking,
    triggerShake,
    cancelShake,
    setShakeManually: setIsShaking
  };
};

export default useShake;
