/** Real paths: /onboard, /job, /employer.
 *  No dependency. Old #/onboard links (already shared) still resolve, and are rewritten
 *  to the clean path so the address bar shows one canonical URL. */
import { useEffect, useState } from 'react';

export const SLUGS = ['onboard', 'job', 'employer'] as const;
export type Slug = (typeof SLUGS)[number];

const isSlug = (v: string): v is Slug => (SLUGS as readonly string[]).includes(v);

export function readSlug(current: Slug): Slug {
  const segment = window.location.pathname.replace(/\/+$/, '').split('/').pop() ?? '';
  if (isSlug(segment)) return segment;

  // Backward compatibility for links shared before routing moved off the hash.
  const fromHash = window.location.hash.replace(/^#\/?/, '').split(/[?&]/)[0];
  if (isSlug(fromHash)) {
    window.history.replaceState(null, '', `/${fromHash}${window.location.search}`);
    return fromHash;
  }

  // A bare domain lands on the first form, and the URL becomes a real page.
  // Any other unknown path keeps whatever page is already open rather than guessing.
  if (!segment) {
    window.history.replaceState(null, '', `/${current}${window.location.search}`);
    return current;
  }
  return current;
}

export function useSlug(fallback: Slug): Slug {
  const [slug, setSlug] = useState<Slug>(() => readSlug(fallback));
  useEffect(() => {
    const sync = () => setSlug((prev) => readSlug(prev));
    // popstate covers back/forward; hashchange covers the in-page skip link (#op-main),
    // which must NOT be mistaken for a route change — readSlug returns prev for it.
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);
  return slug;
}
