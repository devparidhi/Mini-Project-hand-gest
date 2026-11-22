import { useEffect, useState } from 'react';
import HandIllustration from './HandIllustration.jsx';
import Icon from './Icon.jsx';

const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'Space'];
const GESTURE_TIPS = {
  J: 'Point your pinky up, then draw a J down and hook upward.',
  Z: 'Use your index finger to trace a Z in the air.',
  Space: 'Hold your palm open with your fingers pointing sideways and your thumb up.',
};

export default function GestureGuide({ selected, onSelect }) {
  const [reference, setReference] = useState({ coordinates: null, error: false });
  const [requestCount, setRequestCount] = useState(0);
  const selectedIndex = LETTERS.indexOf(selected);

  function chooseSign(letter) {
    if (selected === letter) return;
    setReference({ coordinates: null, error: false });
    onSelect(letter);
  }

  useEffect(() => {
    const controller = new AbortController();
    const modelLabel = selected.toUpperCase();
    fetch('/get_reference?label=' + modelLabel, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Reference unavailable');
        const { landmarks } = await response.json();
        if (landmarks?.length !== 63 || !landmarks.every(Number.isFinite)) {
          throw new Error('Invalid reference');
        }
        if (!controller.signal.aborted) setReference({ coordinates: landmarks, error: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setReference({ coordinates: null, error: true });
      });
    return () => controller.abort();
  }, [selected, requestCount]);

  return (
    <section id="gesture-guide" className="glass-card guide-card watermark" aria-labelledby="guide-heading">
      <div className="guide-layout">
        <div className="guide-controls">
          <h2 id="guide-heading">Explore the alphabet</h2>
          <p className="muted">Choose a letter to study its handshape.</p>
          <div role="group" aria-label="Choose a sign" className="letter-grid">
            {LETTERS.map((letter) => (
              <button key={letter} type="button" aria-pressed={selected === letter}
                onClick={() => chooseSign(letter)}>{letter}</button>
            ))}
          </div>
          <p className="muted guide-note">Single-frame examples from the model dataset.</p>
        </div>
        <div className="reference-preview">
          <div className="reference-heading">
            <h3 aria-live="polite">{selected === 'Space' ? 'Space gesture' : 'Letter ' + selected}</h3>
            <div className="reference-nav">
              <button type="button" aria-label="Previous sign" disabled={selectedIndex === 0}
                onClick={() => chooseSign(LETTERS[selectedIndex - 1])}><Icon name="arrow-left" /></button>
              <button type="button" aria-label="Next sign" disabled={selectedIndex === LETTERS.length - 1}
                onClick={() => chooseSign(LETTERS[selectedIndex + 1])}><Icon name="arrow-right" /></button>
            </div>
          </div>
          {GESTURE_TIPS[selected] && <p className="muted">{GESTURE_TIPS[selected]}</p>}
          {reference.error ? <>
            <p className="error" role="alert">This example could not be loaded.</p>
            <button onClick={() => {
              setReference({ coordinates: null, error: false });
              setRequestCount(requestCount + 1);
            }}>Try again</button>
          </> : reference.coordinates ? (
            <div className="reference-views">
              <figure>
                <figcaption>Hand pose</figcaption>
                <HandIllustration coordinates={reference.coordinates} label={selected} />
              </figure>
              <figure>
                <figcaption>Joint positions</figcaption>
                <HandIllustration coordinates={reference.coordinates} label={selected} landmarksOnly />
              </figure>
            </div>
          ) : <p role="status">Loading example…</p>}
        </div>
      </div>
    </section>
  );
}
