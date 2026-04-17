import { useEffect, useState } from 'react';

/**
 * Live DDoS / threat map. We embed a third-party provider's widget inside an
 * iframe — providers occasionally return 403, X-Frame-Options: DENY, or geo-block
 * the embed, so we need a graceful fallback and a persistent "open in a new tab"
 * escape hatch.
 *
 * Strategy:
 *   1. Try Kaspersky's Cybermap dark widget (designed for embedding).
 *   2. If it doesn't load in 4s, offer Check Point's map as an alternate embed.
 *   3. If neither loads, the persistent footer link below the frame always works.
 */

type Provider = {
  id: string;
  name: string;
  embedUrl: string;
  directUrl: string;
};

const PROVIDERS: Provider[] = [
  {
    id: 'kaspersky',
    name: 'Kaspersky Cybermap',
    embedUrl: 'https://cybermap.kaspersky.com/en/widget/dynamic/dark',
    directUrl: 'https://cybermap.kaspersky.com/',
  },
  {
    id: 'checkpoint',
    name: 'Check Point ThreatMap',
    embedUrl: 'https://threatmap.checkpoint.com/',
    directUrl: 'https://threatmap.checkpoint.com/',
  },
];

const LOAD_TIMEOUT_MS = 4000;

function ThreatMapEmbed() {
  const [providerIdx, setProviderIdx] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const provider = PROVIDERS[providerIdx];

  useEffect(() => {
    if (hasLoaded) return;
    if (typeof window === 'undefined') return;

    const timeout = window.setTimeout(() => {
      setTimedOut(true);
    }, LOAD_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [hasLoaded, providerIdx]);

  const tryNextProvider = () => {
    if (providerIdx < PROVIDERS.length - 1) {
      setProviderIdx(providerIdx + 1);
      setHasLoaded(false);
      setTimedOut(false);
    }
  };

  const showFallback = timedOut && !hasLoaded;
  const hasMoreProviders = providerIdx < PROVIDERS.length - 1;

  return (
    <section className="threat-map-panel" aria-labelledby="threat-map-heading">
      <header className="threat-map-header">
        <h2 id="threat-map-heading">Live DDoS Activity</h2>
        <p>
          Global attack telemetry visualized in real time. If the embed below doesn&rsquo;t
          render on your network, use the link below the map to open the provider directly.
        </p>
      </header>

      <div className="threat-map-frame">
        {!hasLoaded && (
          <div className="skeleton-radar" aria-hidden="true">
            <span className="skeleton-radar-label">Acquiring uplink&hellip;</span>
          </div>
        )}

        <span className="hud-corner-tl" aria-hidden="true" />
        <span className="hud-corner-tr" aria-hidden="true" />
        <span className="hud-corner-bl" aria-hidden="true" />
        <span className="hud-corner-br" aria-hidden="true" />

        <iframe
          key={provider.id}
          title={`${provider.name} live threat map`}
          src={provider.embedUrl}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-same-origin allow-popups"
          onLoad={() => setHasLoaded(true)}
        />

        {showFallback ? (
          <div className="threat-map-fallback" role="alert">
            <p>
              <strong>{provider.name}</strong> didn&rsquo;t load inline. Some networks block
              third-party embeds (Check Point is the most commonly blocked).
            </p>
            <div className="threat-map-fallback-actions">
              {hasMoreProviders && (
                <button
                  type="button"
                  onClick={tryNextProvider}
                  className="threat-map-fallback-link"
                >
                  Try {PROVIDERS[providerIdx + 1].name} &rarr;
                </button>
              )}
              <a
                href={provider.directUrl}
                target="_blank"
                rel="noreferrer"
                className="threat-map-fallback-link threat-map-fallback-link--secondary"
              >
                Open {provider.name} in a new tab
              </a>
            </div>
          </div>
        ) : null}
      </div>

      {/* Persistent footer — always lets the user escape to a real tab, even if
          the iframe appeared to load but rendered a 403/blocked page. */}
      <footer className="threat-map-footer">
        <span className="threat-map-footer-label">
          Showing&nbsp;
          <strong>{provider.name}</strong>
          {hasLoaded ? (
            <span className="threat-map-live-pill">Live</span>
          ) : (
            <span className="threat-map-live-pill threat-map-live-pill--dim">Loading&hellip;</span>
          )}
        </span>
        <div className="threat-map-footer-actions">
          {hasMoreProviders && (
            <button
              type="button"
              onClick={tryNextProvider}
              className="threat-map-footer-link"
            >
              Switch provider
            </button>
          )}
          <a
            href={provider.directUrl}
            target="_blank"
            rel="noreferrer"
            className="threat-map-footer-link"
          >
            Open in new tab &rarr;
          </a>
        </div>
      </footer>
    </section>
  );
}

export default ThreatMapEmbed;
