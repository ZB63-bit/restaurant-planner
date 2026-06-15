import { useEffect } from "react";

function isDarkHour(): boolean {
  const h = new Date().getHours();
  return h >= 19 || h < 7;
}

function msUntilNextTransition(): number {
  const now = new Date();
  const h = now.getHours();
  const next = new Date(now);
  if (h >= 19) { next.setDate(next.getDate() + 1); next.setHours(7, 0, 0, 0); }
  else if (h < 7) { next.setHours(7, 0, 0, 0); }
  else { next.setHours(19, 0, 0, 0); }
  return next.getTime() - now.getTime();
}

export function useDarkMode() {
  useEffect(() => {
    const apply = () => document.documentElement.classList.toggle("dark", isDarkHour());
    apply();
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timeout = setTimeout(() => { apply(); schedule(); }, msUntilNextTransition());
    };
    schedule();
    return () => clearTimeout(timeout);
  }, []);
}
