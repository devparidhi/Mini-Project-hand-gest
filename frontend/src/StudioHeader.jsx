import Icon from './Icon.jsx';

export default function StudioHeader({ theme, onThemeToggle, user, livePractice, onSignOut, signingOut }) {
  const dark = theme === 'dark';

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="brand" href={user ? '#dashboard' : '#main-content'}>
          <img className="brand-mark" src="/favicon.svg" width="38" height="38" alt="" />
          <span>Gesture Flow <span className="brand-accent">AI</span></span>
        </a>
        {user && (
          <nav className="studio-nav" aria-label="Practice tools">
            <a className="motion-link" href="#dashboard" aria-current={livePractice ? undefined : 'page'}>Studio</a>
            <a className="motion-link" href="#live-practice" aria-current={livePractice ? 'page' : undefined}>Live practice</a>
          </nav>
        )}
        <div className="header-actions">
          <button type="button" className="theme-toggle" onClick={onThemeToggle}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
            <Icon name={dark ? 'sun' : 'moon'} />
          </button>
          {user && <button type="button" disabled={signingOut} onClick={onSignOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>}
        </div>
      </div>
    </header>
  );
}
