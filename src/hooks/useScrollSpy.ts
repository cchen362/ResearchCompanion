import { useState, useEffect, useRef } from 'react';

interface UseScrollSpyOptions {
  /** IDs of the elements to observe */
  sectionIds: string[];
  /** Offset from the top of the viewport to trigger activation */
  rootMargin?: string;
}

export function useScrollSpy({ sectionIds, rootMargin = '-100px 0px -60% 0px' }: UseScrollSpyOptions) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const callback: IntersectionObserverCallback = (entries) => {
      // Find the first intersecting entry by DOM order
      const intersecting = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => {
          const aIndex = sectionIds.indexOf(a.target.id);
          const bIndex = sectionIds.indexOf(b.target.id);
          return aIndex - bIndex;
        });

      if (intersecting.length > 0) {
        setActiveId(intersecting[0].target.id);
      }
    };

    observerRef.current = new IntersectionObserver(callback, {
      rootMargin,
      threshold: 0,
    });

    sectionIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        observerRef.current?.observe(element);
      }
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [sectionIds.join(','), rootMargin]);

  return activeId;
}
