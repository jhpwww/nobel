/**
 * mark.ts — how wide the museum's mark is, and how far its plate hangs past it.
 *
 * The mark is the museum's name pinned in the top-left corner of every room
 * (.gr__lock). Three things now stand beside it — the emblem a room hangs by
 * its title, the prize's own sculpture, and a laureate's name — and each of
 * them has to know two figures the stylesheet cannot work out for itself:
 *
 *   --lock-w     the mark's rendered width. It is a line of type, not a share
 *                of the window, and the self-hosted faces change it after
 *                first paint — which is why every caller re-runs this on
 *                document.fonts.ready as well as on resize.
 *   --mark-over  how far the plate hangs past the mark's own box on the right.
 *                The plate is drawn half again as wide as the NAME and centred
 *                on it, so a thing placed beside the mark has to clear the
 *                ornament rather than the box; without this the caught emblem
 *                landed on the acanthus.
 *
 * Both go on <html>, because the elements that read them are in three
 * different components and one of them is fixed to the window.
 */
export function measureMark(): void {
  const lock = document.querySelector<HTMLElement>('.gr__lock');
  if (!lock) return;
  const root = document.documentElement;
  root.style.setProperty('--lock-w', `${Math.round(lock.offsetWidth)}px`);

  const name = lock.querySelector<HTMLElement>('.gr__lock-name');
  if (!name) return;
  const nb = name.getBoundingClientRect();
  const pw = parseFloat(getComputedStyle(name, '::before').width) || 0;
  const over = nb.left + nb.width / 2 + pw / 2 - lock.getBoundingClientRect().right;
  root.style.setProperty('--mark-over', `${Math.max(0, Math.round(over))}px`);
}
