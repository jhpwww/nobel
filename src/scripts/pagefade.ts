/**
 * pagefade.ts — the page dissolves before it reaches the top of the window.
 *
 * The room is pinned behind every page in the bright museum, and a page that
 * scrolls all the way to the top edge covers the top of the photograph for
 * good — the dome, the windows, the whole upper half of the room the visitor
 * came in through. So the page stops short of it: it is gone by the time it
 * reaches half the height of the museum's own mark, and it has been fading
 * since twice that height. Between the two is a band one and a half marks
 * deep, which is where the bar's own chrome stands.
 *
 * A mask, because the page has to become TRANSPARENT rather than be painted
 * over: what is behind it is a photograph, and a white bar across the top of
 * a photograph is exactly the thing being avoided.
 *
 * The two stops are in each element's own coordinates and are written here,
 * because a mask has no `fixed` attachment the way a background does and the
 * band has to stay put in the WINDOW while the element slides under it. Off
 * the element by default, so the page is whole before it has been scrolled
 * and whole with no script at all.
 */
const START = 2;      // where the fade begins, in marks from the top edge
const GONE = 0.5;     // and where nothing is left

export function pageFade() {
  const els = [...document.querySelectorAll<HTMLElement>('[data-fade]')];
  if (!els.length) return;
  const lock = document.querySelector<HTMLElement>('.gr__lock, .bh__lockup');

  let offsets: number[] = [];
  const measure = () => {
    offsets = els.map((el) => el.getBoundingClientRect().top + scrollY);
  };

  const paint = () => {
    /* the mark is the one piece of chrome standing in that band, so it is
       what the page has to clear */
    const mark = lock?.offsetHeight || 40;
    els.forEach((el, i) => {
      const top = scrollY - offsets[i];
      el.style.setProperty('--fade-a', `${(top + GONE * mark).toFixed(1)}px`);
      el.style.setProperty('--fade-b', `${(top + START * mark).toFixed(1)}px`);
    });
  };

  let queued = false;
  const tick = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; paint(); });
  };

  measure();
  paint();
  addEventListener('scroll', tick, { passive: true });
  addEventListener('resize', () => { measure(); paint(); });
  /* the faces arrive after first paint and the mark is a different width in
     the fallback face, which moves everything below it */
  document.fonts?.ready.then(() => { measure(); paint(); });
}
