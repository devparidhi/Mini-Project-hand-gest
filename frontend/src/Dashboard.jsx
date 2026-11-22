import GestureGuide from './GestureGuide.jsx';
import LiveTranslator from './LiveTranslator.jsx';

export default function Dashboard({ user, onSignOut, signingOut, accountError }) {
  return (
    <div className="dashboard">
      <header className="site-header">
        <p className="brand">Gesture Flow <span>AI</span></p>
        <button type="button" disabled={signingOut} onClick={onSignOut}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </header>
      <main>
        {accountError && <p className="error" role="alert">{accountError}</p>}
        <div className="welcome">
          <div>
            <h1>Hello, {user.name}!</h1>
            <p className="muted">Practice fingerspelling and turn your hand signs into text.</p>
          </div>
          <a href="#camera-heading">Go to live camera ↓</a>
        </div>
        <GestureGuide />
        <LiveTranslator />
      </main>
    </div>
  );
}
