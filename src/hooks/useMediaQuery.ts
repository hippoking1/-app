import { useState, useEffect } from 'react';

/**
 * 響應式媒體查詢 Hook，支援 SSR/CSR 安全執行
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQueryList = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    setMatches(mediaQueryList.matches);

    // 現代瀏覽器支援 addEventListener
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', listener);
      return () => mediaQueryList.removeEventListener('change', listener);
    } else {
      // 兼容舊版瀏覽器
      mediaQueryList.addListener(listener);
      return () => mediaQueryList.removeListener(listener);
    }
  }, [query]);

  return matches;
}
