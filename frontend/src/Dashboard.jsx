import { useState } from 'react';
import GestureGuide from './GestureGuide.jsx';
import LiveTranslator from './LiveTranslator.jsx';
import FingerspellingHero from './FingerspellingHero.jsx';
import Icon from './Icon.jsx';

export default function Dashboard({ accountError, livePractice }) {
  const [selected, setSelected] = useState('A');

  return (
    <main id="main-content" className={livePractice ? 'dashboard live-practice' : 'dashboard'} tabIndex={-1}>
      {accountError && <p className="error" role="alert">{accountError}</p>}
      {livePractice ? (
        <>
          <div className="practice-heading" id="live-practice">
            <h1>Live practice</h1>
            <a className="motion-link back-link" href="#dashboard"><Icon name="arrow-left" /> Back to studio</a>
          </div>
          <div className="practice-layout">
            <LiveTranslator />
            <GestureGuide selected={selected} onSelect={setSelected} />
          </div>
        </>
      ) : (
        <div id="dashboard" className="studio-overview">
          <FingerspellingHero practice />
          <GestureGuide selected={selected} onSelect={setSelected} />
        </div>
      )}
    </main>
  );
}
