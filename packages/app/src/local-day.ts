import { useEffect, useState } from "react";
import { localDay } from "@wbr/core";

/**
 * The local day ("2026-10-05"). Checked every minute, when the page becomes
 * visible and when the App turns active again, but it only changes, and so
 * only re-renders, once the date has moved on.
 */
export function useLocalDay(active: boolean): string {
  const [day, setDay] = useState(() => localDay());
  useEffect(() => {
    const check = () => setDay(localDay());
    const visible = () => {
      if (!document.hidden) check();
    };
    const timer = window.setInterval(check, 60000);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  useEffect(() => {
    if (active) setDay(localDay());
  }, [active]);
  return day;
}
