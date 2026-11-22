const ICON_PATHS = {
  'arrow-left': 'M19 12H5m6-6-6 6 6 6',
  'arrow-right': 'M5 12h14m-6-6 6 6-6 6',
  'arrow-down': 'M12 5v14m-6-6 6 6 6-6',
  'arrow-up-right': 'M6 18 18 6m-10 0h10v10',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
  moon: 'M20.8 14.2A9 9 0 0 1 9.8 3.2 9 9 0 1 0 20.8 14.2Z',
  camera: 'M16 10l5-3v10l-5-3M6 6h7a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3Z',
  'camera-off': 'M3 3l18 18M16 10l5-3v10l-5-3M10 6h3a3 3 0 0 1 3 3v3M3 9v6a3 3 0 0 0 3 3h7a3 3 0 0 0 2.1-.9',
  trash: 'M4 7h16M10 7V4h4v3m4 0-1 13H7L6 7m4 4v5m4-5v5',
  volume: 'M4 9v6h4l5 4V5L8 9H4Zm12-1a6 6 0 0 1 0 8m2-10a9 9 0 0 1 0 12',
};

export default function Icon({ name }) {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
