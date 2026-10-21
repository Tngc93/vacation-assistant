"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * True once the element has come into view (and stays true). Heavy widgets (MapLibre) wait for it, so they do
 * not compete with the page's first paint. Where IntersectionObserver is missing it is true at once.
 */
export function useNearViewport<T extends Element>(rootMargin = "0px"): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- environments without IntersectionObserver load at once
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);
  return [ref, near];
}
