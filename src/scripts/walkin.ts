/**
 * walkin.ts — the "step into the gallery" transition for the CSS halls.
 *
 * Clicking a plinth pushes the whole room toward that plinth while a wash in
 * the gallery's own colour rises, then navigation happens. Transform and
 * opacity only, so it stays on the compositor.
 *
 * Skipped entirely when the visitor has turned motion off (motionOn()), and
 * for modified clicks (open in a new tab must keep working).
 */
import { motionOn } from './motion';

export function wireWalkIn(opts: {
  scene: HTMLElement;          // the element that gets pushed
  veil: HTMLElement;           // the colour wash
  links: NodeListOf<HTMLAnchorElement> | HTMLAnchorElement[];
}) {
  const { scene, veil, links } = opts;
  // asked per click, not once at load: the visitor can flip the preference
  const animate = () => motionOn();

  for (const a of Array.from(links)) {
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || (e as MouseEvent).button !== 0) return;
      if (!animate()) return;               // no transition: let the link behave normally
      e.preventDefault();

      const r = a.getBoundingClientRect();
      // where the clicked plinth sits, as a fraction of the viewport
      const fx = (r.left + r.width / 2) / innerWidth - 0.5;
      const fy = (r.top + r.height / 2) / innerHeight - 0.5;

      veil.style.setProperty('--veil', getComputedStyle(a).getPropertyValue('--accent') || '#e0aa53');
      scene.style.setProperty('--wx', `${(-fx * 46).toFixed(1)}%`);
      scene.style.setProperty('--wy', `${(-fy * 26).toFixed(1)}%`);

      // Zooming the room means re-rasterising every composited layer at the
      // new scale. A phone cannot afford that on top of an already heavy 3D
      // scene — iOS discards the tab — so small screens get the wash and the
      // fade without the zoom.
      const roomy = matchMedia('(min-width: 62.01rem)').matches;
      scene.style.setProperty('--walk-zoom', roomy ? '2.35' : '1');
      scene.style.setProperty('--walk-zoom-near', roomy ? '2.1' : '1');
      scene.setAttribute('data-walking', '');
      requestAnimationFrame(() => veil.setAttribute('data-on', ''));

      setTimeout(() => { location.href = a.href; }, 760);
    });
  }
}
