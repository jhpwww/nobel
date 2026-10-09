/**
 * motion.ts — one place that decides whether this site animates.
 *
 * The museum animates. Its only switch is its own: the visitor can turn motion
 * off with MotionToggle, per browser, and back on the same way.
 *
 *   on  (default) — animate; a stored 'auto' from before reads as this
 *   off           — never animate
 *
 * The operating system's `prefers-reduced-motion` is NOT consulted, at the
 * owner's word (2026-10-10). On Windows that signal is the same switch as
 * "Animation effects" in Settings › Accessibility › Visual effects, which
 * people turn off for performance — and while this file followed it ('auto'
 * meant "follow the OS") the official site stood still for them: the logo
 * no longer rose and shrank as a page scrolled, the halls stopped turning.
 * The owner's own browser saw everything move, because it had once pressed
 * the toggle on the GitHub origin and carried `nlm:motion=on` in that
 * origin's localStorage — a per-origin override the official host never had.
 * So the OS is out of the decision, and the default is on.
 *
 * The chosen value lands on <html data-motion="…"> before first paint — the
 * inline script in Base.astro makes the same decision in the same words — so
 * CSS and JS agree and nothing flashes.
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

/** the single question every animation should ask */
export function motionOn(): boolean {
  return readPref() !== 'off';
}

/**
 * And the one question a JOURNEY should ask, which is not the same question.
 *
 * Pressing the way on, or the key that returns to the top, asks the page to go
 * somewhere. The movement between here and there is not an ornament on that
 * answer, it IS the answer: it is what tells the reader that the page moved
 * rather than that a different page arrived, and which way it went. Teleport
 * a screen and they have lost their place — which is the disorientation the
 * setting is there to prevent, arrived at from the other side.
 *
 * So a journey is smooth unless the visitor has said, in this museum, that
 * they want no motion. Today the two questions have the same answer, since
 * the OS is consulted for neither; they stay two questions because they were
 * not always the same — when motionOn() still followed the OS, this one never
 * did — and a journey must never again be gated on anything but the toggle.
 */
export function journeysAnimate(): boolean {
  return readPref() !== 'off';
}

export function applyPref(p: MotionPref = readPref()) {
  document.documentElement.setAttribute('data-motion', p === 'off' ? 'off' : 'on');
}

export function setPref(p: MotionPref) {
  try { localStorage.setItem(KEY, p); } catch { /* ignore */ }
  applyPref(p);
  dispatchEvent(new CustomEvent('motionpref', { detail: { on: motionOn(), pref: p } }));
}
