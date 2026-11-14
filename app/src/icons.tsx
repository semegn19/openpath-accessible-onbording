/** Inline SVG icons. Emoji were the first draft and rendered as tofu boxes on a
 *  browser without an emoji font — a broken glyph is worse than no glyph. */
import type { ReactNode } from 'react';

const P: Record<string, ReactNode> = {
  person: <><circle cx="12" cy="8" r="3.2" /><path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6" /></>,
  people: <><circle cx="9" cy="8" r="2.7" /><path d="M3 20c0-3.2 2.7-5 6-5s6 1.8 6 5" /><circle cx="17.5" cy="9" r="2.2" /><path d="M16 14.4c2.9.1 5 1.7 5 4.6" /></>,
  phone: <path d="M7 3h3l2 5-2.2 1.4a12 12 0 0 0 4.8 4.8L16 12l5 2v3a2 2 0 0 1-2.2 2A17 17 0 0 1 5 5.2 2 2 0 0 1 7 3Z" />,
  id: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="11" r="1.8" /><path d="M5.5 16.2c.5-1.4 1.7-2.2 3-2.2s2.5.8 3 2.2M14 10h4M14 13.5h4" /></>,
  card: <><rect x="2.5" y="5.5" width="19" height="13" rx="2" /><path d="M2.5 10h19M6 14.5h4" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5Z" /><path d="M4 18.5V5.5M8 7h7" /></>,
  doc: <><path d="M6 3h8l4 4v14H6Z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  // A passport is a booklet with an emblem, not a sheet of paper: the ID screen shows three
  // document choices, and two identical page icons made them impossible to tell apart.
  passport: <><rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="12" cy="10" r="2.6" /><path d="M8.6 16.6h6.8M12 7.4v5.2M9.4 10h5.2" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.2A2.6 2.6 0 0 1 12 7.4c1.5 0 2.6 1 2.6 2.3 0 1.9-2.6 2-2.6 4" /><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="M8 12.4 10.8 15 16 9.6" /></>,
  work: <><rect x="3" y="7.5" width="18" height="12" rx="2" /><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3 12.5h18" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3.2 2" /></>,
  speaker: <><path d="M4 9.5h3L12 5.5v13L7 14.5H4Z" /><path d="M16 8.6a5 5 0 0 1 0 6.8M18.6 6a8.4 8.4 0 0 1 0 12" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" /></>,
  'text-large': <><path d="M3 6h9M7.5 6v13M14 11h7M17.5 11v8" /></>,
  simple: <><path d="M12 3.5v2M12 18.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3.5 12h2M18.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /><circle cx="12" cy="12" r="3.4" /></>,
  hands: <><path d="M7 12V6.5a1.6 1.6 0 0 1 3.2 0V12M10.2 11V5.5a1.6 1.6 0 0 1 3.2 0V12M13.4 11.5V7a1.6 1.6 0 0 1 3.2 0v6.5c0 4-2.6 6.5-6.3 6.5-2.6 0-4.3-1.4-5.3-3.6L4 13.6a1.5 1.5 0 0 1 2.6-1.5L7 13" /></>,
  door: <><path d="M5 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17M3.5 21h17M13 12h.01" /></>,
  building: <><rect x="4" y="3" width="10" height="18" rx="1.5" /><path d="M14 9h5.5a.5.5 0 0 1 .5.5V21M7 7h4M7 11h4M7 15h4M2.5 21h19" /></>,
  home: <><path d="M4 11 12 4l8 7v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" /><path d="M9.5 21v-6h5v6" /></>,
  desk: <><path d="M3 9h18M5 9v11M19 9v11M3 6.5h18v2.5H3Z" /><path d="M9 13h6" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></>,
  screen: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></>,
  // A speech bubble with two lines of writing: the question mark for "which language", without
  // the "which country" reading a flag carries.
  chat: <><path d="M20.5 12.1c0 3.5-3.8 6.3-8.5 6.3-.9 0-1.8-.1-2.6-.3L4.5 20.2l1.2-3.2c-1.3-1.2-2.2-2.9-2.2-4.9 0-3.5 3.8-6.3 8.5-6.3s8.5 2.8 8.5 6.3Z" /><path d="M8.6 10.6h6.8M8.6 13.8h4.4" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z" /><circle cx="12" cy="14" r="3.5" /></>,
  alert: <><path d="M12 4 2.8 20h18.4Z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.4" r=".9" fill="currentColor" stroke="none" /></>,
};

/* A language is written in a script, so the script itself is the icon: anyone who reads Amharic
 * recognises አ, and anyone who reads English recognises A. Flags would say "which country", which is
 * a question this form deliberately never asks — and Windows Chrome has no flag emoji at all. */
const LETTERS: Record<string, string> = { 'letter-am': 'አ', 'letter-en': 'A', 'letter-om': 'O', 'letter-ti': 'ት' };

export function Icon({ name }: { name?: string }) {
  if (!name) return null;
  const letter = LETTERS[name];
  if (letter) {
    return (
      <svg className="op-svg op-svg-letter" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <text x="12" y="12" textAnchor="middle" dominantBaseline="central">{letter}</text>
      </svg>
    );
  }
  const body = P[name];
  if (!body) return null;
  return (
    <svg className="op-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"
      fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {body}
    </svg>
  );
}
