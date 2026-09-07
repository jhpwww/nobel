import type { Lang } from './ui';
import { DEFAULT_LANG } from './ui';

const BASE = import.meta.env.BASE_URL; // e.g. '/nobel/'

/**
 * The single place internal URLs are built. Everything respects `base`, so
 * moving to a custom domain is a config change and nothing else.
 */
export function path(lang: Lang, ...segments: (string | number)[]): string {
  const prefix = lang === DEFAULT_LANG ? '' : `${lang}/`;
  const tail = segments.filter((s) => s !== '' && s != null).join('/');
  return `${BASE}${prefix}${tail}${tail ? '/' : ''}`.replace(/\/{2,}/g, '/');
}

export const home = (l: Lang) => path(l);
export const gallery = (l: Lang, cat: string) => path(l, 'gallery', cat);
export const lecture = (l: Lang, id: string) => path(l, 'lecture', id);
export const browse = (l: Lang) => path(l, 'lectures');
export const about = (l: Lang) => path(l, 'about');
export const learn = (l: Lang) => path(l, 'learn');
export const asset = (p: string) => `${BASE}${p.replace(/^\//, '')}`;

/** The same page in the other language. */
export function otherLang(lang: Lang, ...segments: (string | number)[]) {
  const other: Lang = lang === 'zh' ? 'en' : 'zh';
  return { lang: other, href: path(other, ...segments) };
}
