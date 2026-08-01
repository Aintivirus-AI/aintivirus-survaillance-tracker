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
  const [embedRequested, setEmbedRequested] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const provider = PROVIDERS[providerIdx];
  const hasMoreProviders = providerIdx < PROVIDERS.length - 1;

  useEffect(() => {
    if (!embedRequested || hasLoaded) return;
    if (typeof window === 'undefined') return;

    const timeout = window.setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [embedRequested, hasLoaded, providerIdx]);

  const tryNextProvider = () => {
    if (!hasMoreProviders) return;
    setProviderIdx(providerIdx + 1);
    setHasLoaded(false);
    setTimedOut(false);
  };

  return (
    <section className="threat-map-panel" aria-labelledby="threat-map-heading">
      <header className="threat-map-header">
        <h2 id="threat-map-heading">Live DDoS activity</h2>
        <p>
          Global attack telemetry from third-party providers. These embeds are
          frequently blocked by networks and extensions, so they load on request.
        </p>
      </header>

      {!embedRequested ? (
        /*
         * Deliberately not auto-mounting the iframe.
         *
         * An iframe fires `load` even when it renders a provider's block page,
         * and cross-origin content can't be inspected — so the old code set
         * hasLoaded=true, suppressed its own fallback, and left roughly 900px
         * of empty black labelled "Live". A placeholder that always renders
         * beats an embed that silently might not.
         */
        <div className="threat-map-placeholder">
          <div className="threat-map-placeholder-body">
            <span className="threat-map-placeholder-eyebrow">Third-party feed</span>
            <p className="threat-map-placeholder-title">{provider.name}</p>
            <p className="threat-map-placeholder-copy">
              Opens in a new tab, or load it inline here. Inline embeds are blocked
              on many corporate and privacy-filtered networks.
            </p>
          </div>
          <div className="threat-map-placeholder-actions">
            <a
              className="threat-map-primary-action"
              href={provider.directUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open live map &rarr;
            </a>
            <button
              type="button"
              className="threat-map-secondary-action"
              onClick={() => setEmbedRequested(true)}
            >
              Load inline
            </button>
            {hasMoreProviders && (
              <button
                type="button"
                className="threat-map-secondary-action"
                onClick={tryNextProvider}
              >
                Use {PROVIDERS[providerIdx + 1].name}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="threat-map-frame">
          {!hasLoaded && !timedOut && (
            <div className="skeleton-radar" aria-hidden="true">
              <span className="skeleton-radar-label">Acquiring uplink&hellip;</span>
            </div>
          )}

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

          {timedOut ? (
            <div className="threat-map-fallback" role="alert">
              <p>
                <strong>{provider.name}</strong> didn&rsquo;t render inline — your network
                or an extension is most likely blocking it.
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
                  Open in a new tab
                </a>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

export default ThreatMapEmbed;
