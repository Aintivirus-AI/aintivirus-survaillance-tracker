import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SVGProps } from 'react';

import { useDataset } from './hooks/useDataset';
import Footer from './components/Footer';
import InteractiveMap from './components/InteractiveMap';
import Navbar from './components/Navbar';
import ThreatMapEmbed from './components/ThreatMapEmbed';
import LiveFeedsSection from './components/LiveFeedsSection';
import type { DatasetRecord, DatasetSource } from './types';

const STATUS_LABELS: Record<string, string> = {
  loading: 'Loading',
  online: 'Live',
  offline: 'Offline Snapshot',
  cached: 'Cached Copy',
  error: 'Error',
};

function formatDate(value?: string): string {
  if (!value) {
    return 'Unknown';
  }
  try {
    const date = new Date(value);
    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'online':
      return 'status-chip online';
    case 'offline':
      return 'status-chip offline';
    case 'cached':
      return 'status-chip cached';
    case 'error':
      return 'status-chip error';
    default:
      return 'status-chip';
  }
}

const FRAME_SEGMENTS = [0, 1, 2];
const PAGE_SIZE = 5;

function UsFlagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 48" {...props}>
      <rect fill="#b22234" height="48" width="64" />
      <rect fill="#ffffff" height="6" width="64" y="6" />
      <rect fill="#ffffff" height="6" width="64" y="18" />
      <rect fill="#ffffff" height="6" width="64" y="30" />
      <rect fill="#ffffff" height="6" width="64" y="42" />
      <rect fill="#3c3b6e" height="24" width="28" />
      <g fill="#ffffff">
        <circle cx="5.5" cy="4.5" r="1.8" />
        <circle cx="11.5" cy="4.5" r="1.8" />
        <circle cx="17.5" cy="4.5" r="1.8" />
        <circle cx="23.5" cy="4.5" r="1.8" />
        <circle cx="8.5" cy="10.5" r="1.8" />
        <circle cx="14.5" cy="10.5" r="1.8" />
        <circle cx="20.5" cy="10.5" r="1.8" />
        <circle cx="5.5" cy="16.5" r="1.8" />
        <circle cx="11.5" cy="16.5" r="1.8" />
        <circle cx="17.5" cy="16.5" r="1.8" />
        <circle cx="23.5" cy="16.5" r="1.8" />
      </g>
    </svg>
  );
}

function CanadaFlagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 48" {...props}>
      <rect fill="#ffffff" height="48" width="64" />
      <rect fill="#d80621" height="48" width="12" />
      <rect fill="#d80621" height="48" width="12" x="52" />
      <path
        d="M32 9.5 34 15h6l-4.8 3.5 1.6 9.3-4.8-3.5-4.8 3.5 1.6-9.3L26 15h6z"
        fill="#d80621"
      />
    </svg>
  );
}

function EuFlagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 48" {...props}>
      <rect fill="#003399" height="48" width="64" />
      <g fill="#ffd700">
        <circle cx="47" cy="24" r="2.1" />
        <circle cx="45" cy="16.5" r="2.1" />
        <circle cx="39.5" cy="11" r="2.1" />
        <circle cx="32" cy="9" r="2.1" />
        <circle cx="24.5" cy="11" r="2.1" />
        <circle cx="19" cy="16.5" r="2.1" />
        <circle cx="17" cy="24" r="2.1" />
        <circle cx="19" cy="31.5" r="2.1" />
        <circle cx="24.5" cy="37" r="2.1" />
        <circle cx="32" cy="39" r="2.1" />
        <circle cx="39.5" cy="37" r="2.1" />
        <circle cx="45" cy="31.5" r="2.1" />
      </g>
    </svg>
  );
}

function EyeOfProvidence(props: SVGProps<SVGSVGElement>) {
  const { className, ...rest } = props;
  const combinedClassName = ['eye-logo', className].filter(Boolean).join(' ');

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 200"
      className={combinedClassName}
      {...rest}
    >
      <defs>
        <linearGradient id="eyeTriangleGradient" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#1d4ed8" />
          <stop offset="48%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <radialGradient id="eyeIrisGradient" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="45%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </radialGradient>
        <filter id="eyeGlowFilter" x="-45%" y="-45%" width="190%" height="190%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="24" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <polygon
        className="eye-triangle"
        fill="url(#eyeTriangleGradient)"
        points="100 18 180 178 20 178"
      />

      <g className="eye-mark">
        <circle
          className="eye-glow"
          cx="100"
          cy="120"
          filter="url(#eyeGlowFilter)"
          r="64"
        />
        <path
          className="eye-outline"
          d="M40 120 Q100 62 160 120 Q100 178 40 120 Z"
        />
        <circle
          className="eye-iris"
          cx="100"
          cy="120"
          fill="url(#eyeIrisGradient)"
          r="28"
        />
        <circle className="eye-pupil" cx="100" cy="120" r="10" />
        <circle className="eye-highlight" cx="114" cy="108" r="6" />
      </g>

      <g className="eye-rays">
        <path d="M100 34 L100 10" />
        <path d="M152 78 L174 66" />
        <path d="M176 132 L196 132" />
        <path d="M48 78 L26 66" />
        <path d="M24 132 L4 132" />
        <path d="M100 172 L100 192" />
      </g>
    </svg>
  );
}

function getOverpassTags(
  record: DatasetRecord,
): Record<string, string> | undefined {
  const raw = record.raw;
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const candidate = (raw as Record<string, unknown>)['tags'];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return undefined;
  }
  const entries = Object.entries(candidate).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  if (entries.length === 0) {
    return undefined;
  }
  return Object.fromEntries(entries);
}

function getRecordSourceUrl(record: DatasetRecord): string | undefined {
  const raw = record.raw;
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const value = (raw as Record<string, unknown>)['sourceUrl'];
  return typeof value === 'string' ? value : undefined;
}

function formatRecordCoordinates(record: DatasetRecord): string | undefined {
  if (
    typeof record.latitude !== 'number' ||
    !Number.isFinite(record.latitude) ||
    typeof record.longitude !== 'number' ||
    !Number.isFinite(record.longitude)
  ) {
    return undefined;
  }
  return `${record.latitude.toFixed(5)}, ${record.longitude.toFixed(5)}`;
}

function FrameStrip() {
  return (
    <div aria-hidden="true" className="frame-strip">
      {FRAME_SEGMENTS.map((segment) => (
        <span key={segment} />
      ))}
    </div>
  );
}

function SourceCard({
  source,
  onSelectRecord,
  selectedRecordId,
}: {
  source: DatasetSource;
  onSelectRecord: (record: DatasetRecord) => void;
  selectedRecordId?: string;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const isOverpass = source.key === 'overpass-alpr';

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return source.records;
    }
    return source.records.filter((record) => {
      const fields = [record.jurisdiction, record.address, record.category];
      if (isOverpass) {
        const tags = getOverpassTags(record);
        if (tags) {
          fields.push(tags.operator, tags.manufacturer, tags.direction);
        }
        const coordinates = formatRecordCoordinates(record);
        if (coordinates) {
          fields.push(coordinates);
        }
        const sourceUrl = getRecordSourceUrl(record);
        if (sourceUrl) {
          fields.push(sourceUrl);
        }
      }
      return fields.some((field) => field?.toLowerCase().includes(query));
    });
  }, [isOverpass, searchTerm, source.records]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [searchTerm, source.key]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const currentPage = Math.min(page, totalPages);
  const pagedRecords = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, currentPage]);

  const locationColumnLabel =
    source.key === 'atlas-of-surveillance'
      ? 'Description'
      : isOverpass
        ? 'Details'
        : 'Location';

  const homepageLink =
    source.key === 'redlightcameralist' ? undefined : source.homepage;

  const hasMatches = filteredRecords.length > 0;
  const rangeStart = hasMatches ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = hasMatches ? rangeStart + pagedRecords.length - 1 : 0;
  const isFiltered = searchTerm.trim().length > 0;

  const pagedRecordViews = pagedRecords.map((record) => {
    const isSelected = record.uid === selectedRecordId;
    const tags = isOverpass ? getOverpassTags(record) : undefined;
    const operator = tags?.operator;
    const manufacturer = tags?.manufacturer;
    const direction = tags?.direction;
    const coordinates = isOverpass ? formatRecordCoordinates(record) : undefined;
    const sourceUrl = isOverpass ? getRecordSourceUrl(record) : undefined;
    const primaryDetail = operator ?? record.address ?? '—';
    const secondaryDetail =
      operator && record.address && operator !== record.address ? record.address : undefined;
    const metaItems: string[] = [];
    if (manufacturer) {
      metaItems.push(`Manufacturer: ${manufacturer}`);
    }
    if (direction) {
      metaItems.push(`Direction: ${direction}°`);
    }
    if (coordinates) {
      metaItems.push(`Coords: ${coordinates}`);
    }

    const renderOverpassDetails = (extraClassName?: string) => {
      const classes = ['overpass-details'];
      if (extraClassName) {
        classes.push(extraClassName);
      }
      return (
        <div className={classes.join(' ')}>
          <div className="overpass-details-primary">{primaryDetail}</div>
          {secondaryDetail ? (
            <div className="overpass-details-secondary">{secondaryDetail}</div>
          ) : null}
          {metaItems.length > 0 ? (
            <div className="overpass-details-meta">{metaItems.join(' • ')}</div>
          ) : null}
          {sourceUrl ? (
            <div className="overpass-details-link">
              <a href={sourceUrl} target="_blank" rel="noreferrer">
                View on OSM
              </a>
            </div>
          ) : null}
        </div>
      );
    };

    const tableLocationContent = isOverpass
      ? renderOverpassDetails('cell-value')
      : <span className="cell-value">{record.address ?? '—'}</span>;

    const cardLocationContent = isOverpass
      ? renderOverpassDetails()
      : <p className="record-card-text">{record.address ?? '—'}</p>;

    return {
      record,
      isSelected,
      tableLocationContent,
      cardLocationContent,
      categoryClassName: `badge ${record.category ?? 'other'}`,
      categoryLabel: record.category ?? 'other',
    };
  });

  return (
    <article className="source-card">
      <header className="source-header">
        <h2>{source.title}</h2>
        <div className="source-meta">
          <span>Total records: {source.records.length}</span>
          {homepageLink ? (
            <a href={homepageLink} target="_blank" rel="noreferrer">
              Source website
            </a>
          ) : null}
        </div>
        {source.description ? (
          <p className="source-description">{source.description}</p>
        ) : null}
      </header>

      <div className="source-controls">
        <label className="source-search">
          <span className="sr-only">Search records</span>
          <input
            aria-label={`Search ${source.title} records`}
            className="source-search-input"
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search records"
            type="search"
            value={searchTerm}
          />
        </label>

        <div className="source-pagination">
          <button
            className="source-pagination-button"
            disabled={currentPage === 1}
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            type="button"
          >
            Previous
          </button>
          <span className="source-pagination-status">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="source-pagination-button"
            disabled={currentPage === totalPages}
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
            type="button"
          >
            Next
          </button>
        </div>
      </div>

      <table className="records-table">
        <thead>
          <tr>
            <th>Jurisdiction</th>
            <th className="col-location-header">{locationColumnLabel}</th>
            <th>Category</th>
          </tr>
        </thead>
        <tbody>
          {pagedRecordViews.length > 0 ? (
            pagedRecordViews.map(({ record, isSelected, tableLocationContent, categoryClassName, categoryLabel }) => (
              <tr
                aria-selected={isSelected}
                className={`records-row${isSelected ? ' records-row-selected' : ''}`}
                key={record.uid}
                onClick={() => onSelectRecord(record)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectRecord(record);
                  }
                }}
                role="row"
                tabIndex={0}
              >
                <td data-label="Jurisdiction">
                  <span className="cell-value">{record.jurisdiction ?? '—'}</span>
                </td>
                <td className="col-location-cell" data-label={locationColumnLabel}>
                  {tableLocationContent}
                </td>
                <td data-label="Category">
                  <span className="cell-value">
                    <span className={categoryClassName}>{categoryLabel}</span>
                  </span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="records-empty" colSpan={3}>
                No records match the current search.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="records-list" role="list">
        {pagedRecordViews.length > 0 ? (
          pagedRecordViews.map(({ record, isSelected, cardLocationContent, categoryClassName, categoryLabel }) => (
            <article
              className={`record-card${isSelected ? ' record-card-selected' : ''}`}
              key={`${record.uid}-card`}
              onClick={() => onSelectRecord(record)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectRecord(record);
                }
              }}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
            >
              <div className="record-card-row">
                <span className="record-card-label">Jurisdiction</span>
                <span className="record-card-value">{record.jurisdiction ?? '—'}</span>
              </div>
              <div className="record-card-row">
                <span className="record-card-label">{locationColumnLabel}</span>
                <div className="record-card-value record-card-value-rich">{cardLocationContent}</div>
              </div>
              <div className="record-card-row record-card-row-inline">
                <span className="record-card-label">Category</span>
                <span className="record-card-value">
                  <span className={categoryClassName}>{categoryLabel}</span>
                </span>
              </div>
            </article>
          ))
        ) : (
          <div className="records-card-empty">No records match the current search.</div>
        )}
      </div>

      <footer className="records-footer">
        <span>Snapshot: {formatDate(source.snapshot.createdAt)}</span>
        {hasMatches ? (
          <span>
            Showing {rangeStart}&ndash;{rangeEnd} of {filteredRecords.length}
            {isFiltered ? ` (filtered from ${source.records.length})` : ''}
          </span>
        ) : (
          <span>0 of {source.records.length} records</span>
        )}
      </footer>
    </article>
  );
}

function RegionSelector() {
  return (
    <div
      aria-label="Geographic coverage"
      className="region-selector"
      role="group"
    >
      <div className="region-pill region-pill-active">
        <UsFlagIcon className="region-flag" />
        <span className="region-label">US</span>
      </div>

      <div aria-disabled="true" className="region-pill region-pill-disabled">
        <CanadaFlagIcon className="region-flag" />
        <span className="region-label">CA</span>
      </div>

      <div aria-disabled="true" className="region-pill region-pill-disabled">
        <EuFlagIcon className="region-flag" />
        <span className="region-label">EU</span>
      </div>
    </div>
  );
}

function App() {
  const { dataset, status, isLoading, error, lastGeneratedAt, refresh } =
    useDataset();
  const [selectedRecord, setSelectedRecord] = useState<DatasetRecord | null>(null);
  const mapPanelRef = useRef<HTMLElement | null>(null);

  const totals = useMemo(() => {
    if (!dataset) {
      return { recordCount: 0, sourceCount: 0 };
    }
    const recordCount = dataset.sources.reduce(
      (sum, source) => sum + source.records.length,
      0,
    );
    return { recordCount, sourceCount: dataset.sources.length };
  }, [dataset]);

  const orderedSources = useMemo(() => {
    if (!dataset) {
      return [];
    }

    const priorityKeys = new Set(['redlightcameralist']);
    const deferredKeys = new Set(['overpass-alpr', 'atlas-of-surveillance']);

    const priority: DatasetSource[] = [];
    const middle: DatasetSource[] = [];
    const deferred: DatasetSource[] = [];

    dataset.sources.forEach((source) => {
      if (priorityKeys.has(source.key)) {
        priority.push(source);
      } else if (deferredKeys.has(source.key)) {
        deferred.push(source);
      } else {
        middle.push(source);
      }
    });

    return [...priority, ...middle, ...deferred];
  }, [dataset]);

  const handleSelectRecord = useCallback(
    (record: DatasetRecord) => {
      setSelectedRecord(record);

      const target = mapPanelRef.current;
      if (!target) {
        return;
      }

      const scroll = () => {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };

      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(scroll);
      } else {
        scroll();
      }
    },
    [mapPanelRef],
  );

  useEffect(() => {
    if (!dataset) {
      if (selectedRecord) {
        setSelectedRecord(null);
      }
      return;
    }

    if (!selectedRecord) {
      return;
    }

    const recordStillExists = dataset.sources.some((source) =>
      source.records.some((record) => record.uid === selectedRecord.uid),
    );

    if (!recordStillExists) {
      setSelectedRecord(null);
    }
  }, [dataset, selectedRecord]);

  return (
    <>
      <div aria-hidden="true" className="background-orb" />
      <Navbar />

      <div className="app">
        <FrameStrip />

        <header className="hero">
          <div className="hero-top">
            <div className="brand-block">
              <EyeOfProvidence className="brand-logo" />
              <div className="brand-copy">
                <h1 className="brand">Aintivirus Survaillance Tracker</h1>
                <p>
                  Live situational awareness across license plate readers, red-light
                  cams, and municipal surveillance programs.
                </p>
              </div>
            </div>
            <div className="hero-controls">
              <RegionSelector />
              <div className="actions">
                <span className={getStatusClass(status)}>
                  <span className="status-dot" />
                  {STATUS_LABELS[status] ?? status}
                </span>
                <button
                  className="refresh-button"
                  disabled={isLoading}
                  onClick={() => refresh()}
                  type="button"
                >
                  {isLoading ? 'Refreshing...' : 'Refresh data'}
                </button>
              </div>
            </div>
          </div>
          <div className="hero-metrics">
            <div className="metric-card">
              <h3>Total sources</h3>
              <strong>{totals.sourceCount}</strong>
            </div>
            <div className="metric-card">
              <h3>Government records tracked</h3>
              <strong>{totals.recordCount}</strong>
            </div>
            <div className="metric-card">
              <h3>Dataset updated</h3>
              <strong>{formatDate(lastGeneratedAt)}</strong>
            </div>
          </div>
        </header>

        <main className="content-shell">
          {status !== 'online' && lastGeneratedAt ? (
            <div className="info-banner">
              Live updates are unavailable. Displaying cached data from{' '}
              {formatDate(lastGeneratedAt)}.
            </div>
          ) : null}
          {error && status === 'error' ? (
            <div className="error-banner">{error}</div>
          ) : null}

          {!dataset && isLoading ? (
            <div className="empty-state">
              Fetching dataset&hellip; If this takes a while, the live engine may be
              warming up.
            </div>
          ) : null}

          {dataset ? (
            orderedSources.length > 0 ? (
              <section className="sources-grid">
                {orderedSources.map((source, index) => (
                  <Fragment key={source.key}>
                    <SourceCard
                      onSelectRecord={handleSelectRecord}
                      selectedRecordId={selectedRecord?.uid}
                      source={source}
                    />
                    {index === 0 ? (
                      <InteractiveMap ref={mapPanelRef} record={selectedRecord} />
                    ) : null}
                  </Fragment>
                ))}
              </section>
            ) : (
              <div className="empty-state">
                No datasets available yet. Run the ingestion engine to populate the tracker.
              </div>
            )
          ) : null}

          <ThreatMapEmbed />
          <LiveFeedsSection />
        </main>

        <FrameStrip />
        <Footer />
      </div>
    </>
  );
}

export default App;

