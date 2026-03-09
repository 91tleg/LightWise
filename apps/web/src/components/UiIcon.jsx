import React from "react";

const paths = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  map: (
    <>
      <path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 3v15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M15 6v15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .7.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.7Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  bell: (
    <>
      <path d="M15 17H9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 17H6l1.2-1.4c.5-.6.8-1.4.8-2.2v-2.1a4 4 0 1 1 8 0v2.1c0 .8.3 1.6.8 2.2L18 17Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 20a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M5 19a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  logout: (
    <>
      <path d="M14 16l4-4-4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 12H9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M11 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.8-2.8 8.3-7 10-4.2-1.7-7-5.2-7-10V6l7-3Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="m9.3 12.5 1.8 1.8 3.8-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2.5 20h19L12 3Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 9v4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1" />
    </>
  ),
  activity: (
    <>
      <path d="M3 12h4l2-5 4 10 2-5h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  radio: (
    <>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M5 8a10 10 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7.8 10.8a6 6 0 0 1 8.4 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7.8 13.2a6 6 0 0 0 8.4 0" fill="none" stroke="currentColor" strokeWidth="0" />
    </>
  ),
  bolt: (
    <>
      <path d="M13 2 5 13h5l-1 9 8-11h-5l1-9Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  save: (
    <>
      <path d="M5 21h14a1 1 0 0 0 1-1V7.5L16.5 4H5a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 4v5h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 17h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  dot: <circle cx="12" cy="12" r="6" />,
};

export default function UiIcon({ name, size = 20, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {paths[name] || paths.dot}
    </svg>
  );
}