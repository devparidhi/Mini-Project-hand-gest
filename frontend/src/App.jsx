import { useEffect, useState } from 'react';
import Dashboard from './Dashboard.jsx';

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
    <main className="account-page">
      <section className="glass-card account-card" aria-labelledby="account-heading">
        <p className="brand">Gesture Flow <span>AI</span></p>
        <h1 id="account-heading">{registering ? 'Create your account' : 'Welcome back'}</h1>
        <p className="muted">Sign in to practice ASL fingerspelling and translate gestures with your camera.</p>
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
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

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
      setUser(null);
    } catch (error) {
      setError(error.message);
    } finally {
      setSigningOut(false);
    }
  }

  if (user === undefined) {
    return (
      <main className="account-page">
        <section className="glass-card account-card">
          <h1 className="brand">Gesture Flow <span>AI</span></h1>
          {error ? <>
            <p className="error" role="alert">{error}</p>
            <button onClick={() => { setError(''); setChecking(checking + 1); }}>Try again</button>
          </> : <p role="status">Checking your session…</p>}
        </section>
      </main>
    );
  }

  return user
    ? <Dashboard user={user} onSignOut={signOut} signingOut={signingOut} accountError={error} />
    : <AccountForm onSuccess={setUser} />;
}
