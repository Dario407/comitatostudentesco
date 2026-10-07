export type IconName =
  | "vote"
  | "dashboard"
  | "users"
  | "archive"
  | "logout"
  | "plus"
  | "download"
  | "check"
  | "more"
  | "close"
  | "calendar"
  | "search"
  | "back"
  | "clock"
  | "lock";

const PATHS: Record<IconName, React.ReactNode> = {
  vote: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <path d="m8.2 12.2 2.6 2.6 5-5.6" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3.5" y="3.5" width="7" height="9" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="2" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="2" />
      <rect x="3.5" y="15.5" width="7" height="5" rx="2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.8 20c.4-3.4 3-5.5 6.2-5.5s5.8 2.1 6.2 5.5" />
      <path d="M16 4.7a3.4 3.4 0 0 1 0 6.3M18.2 14.8c1.7.7 2.8 2.4 3 4.7" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4" width="18" height="5" rx="1.5" />
      <path d="M5 9v8.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V9M10 13h4" />
    </>
  ),
  logout: (
    <>
      <path d="M9.5 20.5h-4a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h4" />
      <path d="m16 16.5 4.5-4.5L16 7.5M20.5 12h-11" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  download: (
    <>
      <path d="M12 4v11M7.5 10.8 12 15.3l4.5-4.5" />
      <path d="M4.5 19.5h15" />
    </>
  ),
  check: <path d="m5 12.8 4.4 4.4L19 7.4" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="18.5" cy="12" r="1.2" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  back: <path d="M19 12H5.5M11 6.5 5.5 12l5.5 5.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  )
};

export default function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
