import { useEffect, useState } from 'react';
import HandIllustration from './HandIllustration.jsx';

const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'Space'];

export default function GestureGuide() {
  const [selected, setSelected] = useState('A');
  const [reference, setReference] = useState({ coordinates: null, error: false });
  const [requestCount, setRequestCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const modelLabel = selected === 'Y' ? 'YY' : selected.toUpperCase();
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
    <section id="gesture-guide" className="glass-card guide-card" aria-labelledby="guide-heading">
      <h2 id="guide-heading">Gesture guide</h2>
      <p className="muted">Choose a letter or Space to see its hand pose and joint positions.</p>
      <div className="guide-layout">
        <div role="group" aria-label="Choose a sign" className="letter-grid">
          {LETTERS.map((letter) => (
            <button key={letter} type="button" aria-pressed={selected === letter} onClick={() => {
              if (selected === letter) return;
              setReference({ coordinates: null, error: false });
              setSelected(letter);
            }}>{letter}</button>
          ))}
        </div>
        <div className="reference-preview">
          <h3>{selected === 'Space' ? 'Space' : 'Letter ' + selected}</h3>
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
                <figcaption>Stick figure</figcaption>
                <HandIllustration coordinates={reference.coordinates} label={selected} landmarksOnly />
              </figure>
            </div>
          ) : <p role="status">Loading example…</p>}
        </div>
      </div>
      <p className="muted guide-note">Illustrations show one frame from each gesture recorded for this model.</p>
    </section>
  );
}
