/**
 * motion.ts — one place that decides whether this site animates.
 *
 * `prefers-reduced-motion` is respected by default, as it must be. But it is a
 * blunt OS-wide switch — on Windows, turning off "Animation effects" (which
 * people do for performance) silently kills every effect here, with no way
 * back. So the visitor gets the final say, stored per browser.
 *
 *   auto (default) — follow the operating system
 *   on             — animate regardless
 *   off            — never animate
 *
 * The chosen value lands on <html data-motion="…"> before first paint, so CSS
 * and JS agree and nothing flashes.
 */
export type MotionPref = 'auto' | 'on' | 'off';
const KEY = 'nlm:motion';

export function readPref(): MotionPref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'on' || v === 'off' || v === 'auto') return v;
  } catch { /* private mode, blocked storage */ }
  return 'auto';
}

function systemReduces(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** the single question every animation should ask */
export function motionOn(): boolean {
  const p = readPref();
  if (p === 'on') return true;
  if (p === 'off') return false;
  return !systemReduces();
}

export function applyPref(p: MotionPref = readPref()) {
  document.documentElement.setAttribute('data-motion', p === 'auto' ? (systemReduces() ? 'off' : 'on') : p);
}

export function setPref(p: MotionPref) {
  try { localStorage.setItem(KEY, p); } catch { /* ignore */ }
  applyPref(p);
  dispatchEvent(new CustomEvent('motionpref', { detail: { on: motionOn(), pref: p } }));
}

/** true when the OS asked for less motion and the visitor has not overridden it */
export const isSuppressedBySystem = () => systemReduces() && readPref() === 'auto';
