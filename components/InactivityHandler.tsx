import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

const TIMEOUT_DURATION = 1800000; // 30 minutes

const InactivityHandler: React.FC = () => {
  const { user, handleLogout } = useStore();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (user) {
      timerRef.current = setTimeout(() => {
        handleLogout();
        alert("Sesi anda telah tamat tempoh kerana tiada aktiviti selama 1 jam. Anda telah dilog keluar secara automatik.");
      }, TIMEOUT_DURATION);
    }
  };

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      window.addEventListener(event, resetTimer, true);
    });

    resetTimer();

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetTimer, true);
      });
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user]);

  return null;
};

export default InactivityHandler;
