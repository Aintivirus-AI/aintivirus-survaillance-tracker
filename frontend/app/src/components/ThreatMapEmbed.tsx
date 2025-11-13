import { useEffect, useState } from 'react';

const LOAD_TIMEOUT_MS = 8000;

function ThreatMapEmbed() {
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isFallbackVisible, setIsFallbackVisible] = useState(false);

  useEffect(() => {
    if (hasLoaded) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const timeout = window.setTimeout(() => {
      setIsFallbackVisible(true);
    }, LOAD_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [hasLoaded]);

  return (
    <section className="threat-map-panel" aria-labelledby="threat-map-heading">
      <header className="threat-map-header">
        <h2 id="threat-map-heading">Live DDoS Activity</h2>
        <p>
          Real-time visualization of global DDoS attack telemetry provided by Check Point
          Software Technologies. The feed may take a few seconds to initialize.
        </p>
      </header>

      <div className="threat-map-frame">
        <iframe
          title="Check Point DDoS Live Threat Map"
          src="https://threatmap.checkpoint.com/"
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => setHasLoaded(true)}
        />

        {isFallbackVisible && !hasLoaded ? (
          <div className="threat-map-fallback" role="alert">
            <p>
              We are unable to display the live threat map within the page. This can happen
              if third-party embeds are blocked by your browser or network.
            </p>
            <a
              href="https://threatmap.checkpoint.com/"
              target="_blank"
              rel="noreferrer"
              className="threat-map-fallback-link"
            >
              Open the live map in a new tab
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default ThreatMapEmbed;


