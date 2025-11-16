import { useEffect, useState } from 'react';

const LOAD_TIMEOUT_MS = 4000;

type LiveFeed = {
  key: string;
  title: string;
  description: string;
  href: string;
  linkLabel?: string;
  embed?: {
    src: string;
  };
  fallbackMessage?: string;
};

type LiveFeedGroup = {
  key: string;
  heading: string;
  description: string;
  feeds: LiveFeed[];
};

const FEED_GROUPS: LiveFeedGroup[] = [
  {
    key: 'transport',
    heading: 'Live Transport Monitors',
    description:
      'Spot air and maritime movements in real time through low-latency radar visualizations.',
    feeds: [
      {
        key: 'flight-tracker',
        title: 'Flightradar24 Focus View',
        description:
          'Zoomed view centered over the U.S. Mountain West. Explore aircraft telemetry, routes, and identifiers.',
        href: 'https://www.flightradar24.com/39.74,-104.42/6',
        linkLabel: 'Open full Flightradar24 map',
        fallbackMessage:
          'Flightradar24 restricts embedding on external sites. Launch the full air traffic viewer in a new tab.',
      },
      {
        key: 'ship-tracker',
        title: 'VesselFinder Global Map',
        description:
          'Live AIS maritime traffic map with vessel metadata and port activity overlays.',
        href: 'https://www.vesselfinder.com/',
        linkLabel: 'Open VesselFinder in new tab',
        fallbackMessage:
          'VesselFinder does not permit embedding. Launch the full maritime traffic viewer in a new tab.',
      },
    ],
  },
  {
    key: 'public-cameras',
    heading: 'Public Camera Network',
    description:
      'Browse curated, publicly accessible camera feeds for situational awareness and on-the-ground context.',
    feeds: [
      {
        key: 'cameraftp',
        title: 'CameraFTP Published Cameras',
        description:
          'Community-published security and monitoring cameras organized by geography and category.',
        href: 'https://www.cameraftp.com/cameraftp/publish/publishedcameras.aspx',
        linkLabel: 'Open CameraFTP directory',
        fallbackMessage:
          'CameraFTP directories are best viewed in a dedicated window. Use the direct link to browse live listings.',
      },
      {
        key: 'earthcam',
        title: 'EarthCam Network',
        description:
          'Dozens of high-resolution vantage points across America, including municipal, traffic, and landmark views.',
        href: 'https://www.earthcam.com/network/?page=PA&country=US',
        linkLabel: 'Open EarthCam network page',
        fallbackMessage:
          'EarthCam requires loading within their site to access the full network directory. Open the link for the complete experience.',
      },
    ],
  },
];

function LiveFeedCard({ feed }: { feed: LiveFeed }) {
  const hasEmbed = Boolean(feed.embed);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isFallbackVisible, setIsFallbackVisible] = useState(!hasEmbed);

  useEffect(() => {
    if (!hasEmbed || hasLoaded) {
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
  }, [hasEmbed, hasLoaded]);

  return (
    <article className="live-feed-card">
      <header className="live-feed-card-header">
        <h3 className="live-feed-card-title">{feed.title}</h3>
        <p className="live-feed-card-description">{feed.description}</p>
      </header>

      {hasEmbed ? (
        <div className="live-feed-frame">
          <iframe
            title={feed.title}
            src={feed.embed?.src}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={() => {
              setHasLoaded(true);
              setIsFallbackVisible(false);
            }}
          />

          {isFallbackVisible && !hasLoaded ? (
            <div className="live-feed-fallback" role="alert">
              <p>{feed.fallbackMessage ?? 'This provider prevents embedding on some networks.'}</p>
              <a
                href={feed.href}
                target="_blank"
                rel="noreferrer"
                className="live-feed-fallback-link"
              >
                {feed.linkLabel ?? 'Open feed in new tab'}
              </a>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="live-feed-placeholder" role="status">
          <p>{feed.fallbackMessage ?? 'This provider does not permit embedding inside other sites.'}</p>
          <a href={feed.href} target="_blank" rel="noreferrer" className="live-feed-fallback-link">
            {feed.linkLabel ?? 'Open feed in new tab'}
          </a>
        </div>
      )}

      <footer className="live-feed-card-footer">
        <a href={feed.href} target="_blank" rel="noreferrer" className="live-feed-card-link">
          {feed.linkLabel ?? 'Open source in new tab'}
        </a>
      </footer>
    </article>
  );
}

function LiveFeedsSection() {
  return (
    <section className="live-feeds-section" aria-labelledby="live-feeds-heading">
      <header className="live-feeds-intro">
        <h2 id="live-feeds-heading">Live Transport & Camera Feeds</h2>
        <p>
          Quick-access embeds for tracking aerial, maritime, and public camera telemetry. These
          viewers complement the dataset explorer by giving immediate visuals from the field.
        </p>
      </header>

      {FEED_GROUPS.map((group) => (
        <div className="live-feeds-group" key={group.key} aria-labelledby={`${group.key}-heading`}>
          <div className="live-feeds-group-header">
            <h3 id={`${group.key}-heading`}>{group.heading}</h3>
            <p>{group.description}</p>
          </div>
          <div className="live-feeds-grid">
            {group.feeds.map((feed) => (
              <LiveFeedCard key={feed.key} feed={feed} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

export default LiveFeedsSection;

