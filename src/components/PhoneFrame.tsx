import { useEffect, useState } from 'react';

/**
 * The status bar of the drawn phone that frames the app on a desktop screen
 * (see .phone in app.css): the time, the camera island, signal, Wi-Fi and
 * battery. It is decoration only, hidden from screen readers, and not shown
 * at all on a real phone, where the phone draws its own.
 */
// The drawn phone's full size: a 390 x 844 screen plus its 11 px frame, and
// the room left around it in the window (app.css, .phone and .stage).
const PHONE_W = 390 + 22;
const PHONE_H = 844 + 22;
const MARGIN = 24;

/** How much to shrink the drawn phone so all of it fits the window, keeping its shape. */
function fitPhone() {
  const scale = Math.min(1, (window.innerHeight - MARGIN) / PHONE_H, (window.innerWidth - MARGIN) / PHONE_W);
  document.documentElement.style.setProperty('--phone-zoom', String(Math.max(0.5, Math.round(scale * 1000) / 1000)));
}

export function PhoneStatusBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    fitPhone();
    window.addEventListener('resize', fitPhone);
    return () => window.removeEventListener('resize', fitPhone);
  }, []);
  const time = `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`;
  return (
    <div className="phone-status" aria-hidden>
      <span className="phone-time">{time}</span>
      <span className="phone-island" />
      <span className="phone-icons">
        <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
        <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.6 10.4 9a3.4 3.4 0 0 0-4.8 0Z" /><path d="M3.6 6.9 4.9 8.3a4.4 4.4 0 0 1 6.2 0l1.3-1.4a6.3 6.3 0 0 0-8.8 0Z" /><path d="M1.2 4.4l1.3 1.4a7.8 7.8 0 0 1 11 0l1.3-1.4a9.7 9.7 0 0 0-13.6 0Z" /></svg>
        <svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" strokeOpacity=".4" /><rect x="2.5" y="2.5" width="16" height="8" rx="2" /><path d="M25 4.5v4a2 2 0 0 0 0-4Z" fillOpacity=".45" /></svg>
      </span>
    </div>
  );
}
