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
          Real-time global DDoS telemetry streamed from Check Point&rsquo;s threat intelligence
          network. Rotating globe view refreshes every few seconds.
        </p>
      </header>

      <div className="threat-map-frame">
        {/* Radar skeleton underneath — dismissed once the iframe reports load */}
        {!hasLoaded && (
          <div className="skeleton-radar" aria-hidden="true">
            <span className="skeleton-radar-label">Acquiring uplink…</span>
          </div>
        )}

        {/* HUD corner brackets sit above iframe */}
        <span className="hud-corner-tl" aria-hidden="true" />
        <span className="hud-corner-tr" aria-hidden="true" />
        <span className="hud-corner-bl" aria-hidden="true" />
        <span className="hud-corner-br" aria-hidden="true" />

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
              Unable to display the live threat map inline. Third-party embeds may be blocked
              by your browser or network.
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
