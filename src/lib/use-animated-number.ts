import { useEffect, useRef, useState } from "react";

export function useAnimatedNumber(target: number, duration = 1200) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    fromRef.current = value;
    startRef.current = null;
    let raf = 0;
    const step = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(fromRef.current + (target - fromRef.current) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}

export function useDrift(base: number, amplitude = 0.04, intervalMs = 2200) {
  const [v, setV] = useState(base);
  useEffect(() => {
    const i = setInterval(() => {
      const jitter = (Math.random() - 0.5) * 2 * amplitude * base;
      setV(+(base + jitter).toFixed(2));
    }, intervalMs);
    return () => clearInterval(i);
  }, [base, amplitude, intervalMs]);
  return v;
}
