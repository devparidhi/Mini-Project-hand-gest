import { useEffect, useLayoutEffect, useState } from 'react';
import Dashboard from './Dashboard.jsx';
import FingerspellingHero from './FingerspellingHero.jsx';
import StudioHeader from './StudioHeader.jsx';

const THEME_KEY = 'gesture-flow-theme';

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

async function authRequest(action, fields, signal) {
  const response = await fetch('/api/auth/' + action, {
    signal,
    ...(fields && {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    }),
  });
  if (response.status === 401 && action === 'me') return null;

  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new Error(data?.error || 'The account service is unavailable. Try again.');
  }
  return data.user;
}

function AccountForm({ onSuccess }) {
  const [registering, setRegistering] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const fields = Object.fromEntries(new FormData(event.currentTarget));
      onSuccess(await authRequest(registering ? 'register' : 'login', fields));
    } catch (error) {
      setError(error.message);
    } finally {
      setPending(false);
    }
  }

  return (
      <section className="account-card" aria-labelledby="account-heading">
        <h2 id="account-heading">{registering ? 'Create your account' : 'Welcome back'}</h2>
        <p className="muted">{registering ? 'Create an account to start practicing.' : 'Sign in to open your practice studio.'}</p>
        <form onSubmit={submit} aria-busy={pending}>
          <fieldset disabled={pending}>
            {registering && (
              <label>
                Name
                <input name="name" autoComplete="name" maxLength={80} required />
              </label>
            )}
            <label>
              Email
              <input name="email" type="email" autoComplete="email" maxLength={254} required />
            </label>
            <label>
              Password
              <input key={registering} name="password" type="password" required
                autoComplete={registering ? 'new-password' : 'current-password'}
                minLength={registering ? 8 : undefined} maxLength={128}
                aria-describedby={registering ? 'password-hint' : undefined} />
            </label>
            {registering && <small id="password-hint">Use at least 8 characters.</small>}
            {error && <p className="error" role="alert">{error}</p>}
            <button className="primary" type="submit">
              {pending ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}
            </button>
          </fieldset>
        </form>
        <div className="account-switch">
          <span>{registering ? 'Already have an account?' : 'New to Gesture Flow?'}</span>
          <button type="button" className="text-button" disabled={pending} onClick={() => {
            setRegistering(!registering);
            setError('');
          }}>
            {registering ? 'Sign in' : 'Create an account'}
          </button>
        </div>
      </section>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [theme, setTheme] = useState(readTheme);
  const [livePractice, setLivePractice] = useState(() => window.location.hash === '#live-practice');

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // The toggle still works when browser storage is blocked.
    }
  }, [theme]);

  useEffect(() => {
    function updateScreen() {
      setLivePractice(window.location.hash === '#live-practice');
    }
    window.addEventListener('hashchange', updateScreen);
    return () => window.removeEventListener('hashchange', updateScreen);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    authRequest('me', null, controller.signal).then(setUser).catch((error) => {
      if (!controller.signal.aborted) setError(error.message);
    });
    return () => controller.abort();
  }, [checking]);

  async function signOut() {
    setSigningOut(true);
    setError('');
    try {
      await authRequest('logout', {});
      if (window.location.hash) window.location.hash = '';
      setUser(null);
    } catch (error) {
      setError(error.message);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <a className="skip-link" href="#main-content" onClick={(event) => {
        event.preventDefault();
        document.getElementById('main-content')?.focus();
      }}>Skip to content</a>
      <StudioHeader theme={theme} onThemeToggle={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
        user={user} livePractice={livePractice} onSignOut={signOut} signingOut={signingOut} />
      {user ? <Dashboard accountError={error} livePractice={livePractice} /> : (
        <main id="main-content" className="account-page" tabIndex={-1}>
          <FingerspellingHero />
          <div className="account-form-panel watermark">
            {user === undefined ? (
              <section className="account-card" aria-label="Account status">
                {error ? <>
                  <p className="error" role="alert">{error}</p>
                  <button type="button" onClick={() => { setError(''); setChecking(checking + 1); }}>Try again</button>
                </> : <p className="muted" role="status">Checking your session…</p>}
              </section>
            ) : <AccountForm onSuccess={setUser} />}
          </div>
        </main>
      )}
    </>
  );
}
