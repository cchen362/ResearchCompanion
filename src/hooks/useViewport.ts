import { useState, useEffect } from 'react';

const WIDE_BREAKPOINT = 1440;

export function useIsWideViewport() {
  const [isWide, setIsWide] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= WIDE_BREAKPOINT : false
  );

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${WIDE_BREAKPOINT}px)`);
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches);

    setIsWide(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isWide;
}
