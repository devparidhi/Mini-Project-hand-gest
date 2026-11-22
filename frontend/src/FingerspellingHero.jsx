import Icon from './Icon.jsx';

export default function FingerspellingHero({ practice = false }) {
  return (
    <section className={practice ? 'fingerspelling-hero practice-hero' : 'fingerspelling-hero account-hero'}
      aria-labelledby="fingerspelling-heading">
      <div className="hero-copy">
        <p className="eyebrow">American Sign Language</p>
        <h1 id="fingerspelling-heading">{practice ? 'Fingerspelling studio' : 'Learn ASL, one letter at a time.'}</h1>
        <p className="hero-description">
          {practice
            ? 'Explore the alphabet, then use your camera to see which letters the model recognizes.'
            : 'Explore the ASL alphabet and practice forming letters with live camera feedback.'}
        </p>
        {practice && (
          <div className="hero-actions">
            <a className="hero-link" href="#gesture-guide">Explore the alphabet <Icon name="arrow-down" /></a>
            <a className="hero-link secondary" href="#live-practice">Live practice <Icon name="arrow-up-right" /></a>
          </div>
        )}
      </div>
      <img className="hero-art" src="/fingerspelling-hands.webp" alt="" width="960" height="640" fetchPriority="high" />
    </section>
  );
}
