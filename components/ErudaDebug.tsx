'use client';

import { useEffect } from 'react';

export default function ErudaDebug() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/eruda';
    script.onload = () => {
      if ((window as { eruda?: { init: () => void } }).eruda) {
        (window as { eruda?: { init: () => void } }).eruda!.init();
        console.log('Eruda mobile debugger loaded');
      }
    };
    document.body.appendChild(script);

    return () => {
      const w = window as { eruda?: { destroy: () => void } };
      if (w.eruda) {
        w.eruda.destroy();
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return null;
}
