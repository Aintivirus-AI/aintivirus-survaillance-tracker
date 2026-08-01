import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, SVGProps } from 'react';

import { useDataset } from './hooks/useDataset';
import Footer from './components/Footer';
import InteractiveMap from './components/InteractiveMap';
import Navbar from './components/Navbar';
import ThreatMapEmbed from './components/ThreatMapEmbed';
import GlobalThreatIntelligence from './components/GlobalThreatIntelligence';
import type { DatasetRecord, DatasetSource } from './types';
import {
  getOverpassTags,
  getRecordSourceUrl,
  formatRecordCoordinates,
} from './utils/overpassTags';

const STATUS_LABELS: Record<string, string> = {
  loading: 'Loading',
  online: 'Live',
  offline: 'Offline Snapshot',
  cached: 'Cached Copy',
  error: 'Error',
};

const numberFormat = new Intl.NumberFormat('en-US');

const CATEGORY_LABELS: Record<string, string> = {
  REDLIGHT_CAMERA: 'Red-light camera',
  LICENSE_PLATE_READER: 'Plate reader',
  SPEED_CAMERA: 'Speed camera',
  FACE_RECOGNITION: 'Face recognition',
  BODY_CAMERA: 'Body camera',
  DRONE: 'Drone',
  GUNSHOT_DETECTION: 'Gunshot detection',
  OTHER: 'Other',
};

/** Turn a connector's enum value into something a person would write. */
function formatCategory(value?: string | null): string {
  if (!value) return 'Other';
  const key = value.toUpperCase();
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  const words = value.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatCount(value: number): string {
  return numberFormat.format(value);
}

/**
 * "4 min ago" / "3 hours ago". The absolute timestamp stays available as a
 * tooltip — as a headline metric it wrapped to two lines and orphaned the
 * meridiem, and "how fresh is this" is the question the number answers.
 */
function formatRelative(value?: string, now: number = Date.now()): string {
  if (!value) return 'Unknown';
  const then = Date.parse(value);
  if (Number.isNaN(then)) return 'Unknown';

  const seconds = Math.round((now - then) / 1000);
  if (seconds < 45) return 'Just now';

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['second', 60], ['minute', 60], ['hour', 24], ['day', 30], ['month', 12],
  ];
  let amount = seconds;
  let unit: Intl.RelativeTimeFormatUnit = 'second';
  for (const [name, size] of units) {
    if (Math.abs(amount) < size) { unit = name; break; }
    amount = Math.round(amount / size);
    unit = name === 'second' ? 'minute'
      : name === 'minute' ? 'hour'
      : name === 'hour' ? 'day'
      : name === 'day' ? 'month' : 'year';
  }
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-amount, unit);
}

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
const DEFAULT_PAGE_SIZE = 5;
const REDLIGHT_DESKTOP_PAGE_SIZE = 20;
const DESKTOP_BREAKPOINT_PX = 1024;
const DESKTOP_MEDIA_QUERY = `(min-width: ${DESKTOP_BREAKPOINT_PX}px)`;
const REDLIGHT_SOURCE_KEY = 'redlightcameralist';
const LICENSE_SOURCE_KEY = 'overpass-alpr';
const ATLAS_SOURCE_KEY = 'atlas-of-surveillance';
const SOURCE_RENDER_ORDER = [REDLIGHT_SOURCE_KEY, LICENSE_SOURCE_KEY, ATLAS_SOURCE_KEY];
const PRIORITY_SOURCE_KEYS = new Set([REDLIGHT_SOURCE_KEY, LICENSE_SOURCE_KEY]);
const SCROLL_TARGETS = {
  redlight: `source-${REDLIGHT_SOURCE_KEY}`,
  license: `source-${LICENSE_SOURCE_KEY}`,
} as const;

function useMediaQuery(query: string): boolean {
  const getMatches = () => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    setMatches(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleChange);
      } else if (typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [query]);

  return matches;
}

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

/**
 * All-Seeing Eye — the brand-mark for the tracker.
 *
 * Composition (outer → inner):
 *   1. A rotating rune ring (surveillance bearings, tick marks)
 *   2. A counter-clockwise radar sweep behind the triangle
 *   3. The sacred triangle with inner etching + glowing edge
 *   4. A layered eye: aura, sclera, iris with camera-aperture blades,
 *      pupil, specular highlights
 *   5. Twelve radial rays that pulse in a rolling wave
 *
 * All animation is CSS-driven and respects prefers-reduced-motion.
 */
/**
 * The tracker's mark: a bullet CCTV camera on its wall mount.
 *
 * Replaces the Eye of Providence, which was the symbol of the *surveillant* —
 * wrong for a tool that maps surveillance — and was already the identity of the
 * sibling product at watcher.aintivirus.ai.
 *
 * Deliberately NOT an eye at the lens: a glass highlight rather than a pupil,
 * so the mark reads as equipment rather than re-introducing the symbol it
 * replaced. Drawn on a 64-unit grid so nothing falls below a rendered pixel at
 * the 56–76px this displays at.
 */
function SurveillanceMark(props: SVGProps<SVGSVGElement>) {
  const { className, ...rest } = props;
  const combinedClassName = ['surveillance-mark', className].filter(Boolean).join(' ');

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      fill="none"
      className={combinedClassName}
      {...rest}
    >
      <defs>
        <linearGradient id="cam-body" x1="32" y1="30" x2="32" y2="47" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#0e7490" stopOpacity="0.10" />
        </linearGradient>
        <radialGradient id="cam-glass" cx="38%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#cffafe" />
          <stop offset="45%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#083344" />
        </radialGradient>
      </defs>

      <g className="cam-rig" transform="rotate(-8 32 32) scale(1.07) translate(-2.2 -2.2)">
        {/* Wall plate — a plate, not a floating bar. */}
        <rect
          x="40" y="15" width="14" height="4" rx="1.6"
          fill="#22d3ee" fillOpacity="0.25" stroke="#22d3ee" strokeWidth="2"
        />
        {/* Everything below the plate pans; the plate is bolted to the wall. */}
        <g className="cam-pan">
        {/* Arm down to the barrel. */}
        <path
          d="M47 19 V23 Q47 28 43.5 29.6"
          stroke="#22d3ee" strokeOpacity="0.85" strokeWidth="3.2" strokeLinecap="round"
        />

        {/* Barrel. */}
        <rect
          x="15" y="30" width="33" height="17" rx="5"
          fill="url(#cam-body)" stroke="#22d3ee" strokeWidth="2.4"
        />

        {/* Sun hood: a solid shield sitting on the barrel, overhanging the lens. */}
        <path
          d="M12.4 27.8 H36 A2 2 0 0 1 36 31.8 H12.4 A2 2 0 0 1 12.4 27.8 Z"
          fill="#22d3ee"
        />
        {/* Front lip of the hood, turning down over the lens. */}
        <path
          d="M12.6 29.4 V34"
          stroke="#22d3ee" strokeWidth="2.6" strokeLinecap="round"
        />
        {/* Highlight along the top of the housing. */}
        <path
          d="M15 29.2 H32"
          stroke="#a5f3fc" strokeOpacity="0.65" strokeWidth="1.2" strokeLinecap="round"
        />

        {/* Lens assembly: bezel, IR ring, glass. */}
        <circle cx="19.5" cy="38.5" r="8.2" fill="#08131c" stroke="#22d3ee" strokeWidth="2.2" />
        <circle
          cx="19.5" cy="38.5" r="6"
          stroke="#22d3ee" strokeOpacity="0.5" strokeWidth="1.4"
          strokeDasharray="2.2 2.6"
        />
        <circle cx="19.5" cy="38.5" r="3.8" fill="url(#cam-glass)" />
        {/* Specular streak — glass, not a pupil. */}
        <path
          d="M17.2 36.4 Q19 35 20.9 35.6"
          stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.3" strokeLinecap="round"
        />
        </g>
      </g>
    </svg>
  );
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
  const isAtlas = source.key === 'atlas-of-surveillance';
  const isPrioritySource = PRIORITY_SOURCE_KEYS.has(source.key);
  const allowSelection = !isAtlas;
  const isDesktopViewport = useMediaQuery(DESKTOP_MEDIA_QUERY);
  const pageSize =
      source.key === REDLIGHT_SOURCE_KEY && isDesktopViewport
          ? REDLIGHT_DESKTOP_PAGE_SIZE
          : DEFAULT_PAGE_SIZE;
  const sourceCardClassNames = ['source-card'];
  if (isPrioritySource) {
    sourceCardClassNames.push('source-card-priority');
  }

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = (!query
        ? source.records
        : source.records.filter((record) => {
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
    }));

    if (!isAtlas) {
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      const categoryA = (a.category ?? '').toLowerCase();
      const categoryB = (b.category ?? '').toLowerCase();
      if (categoryA === categoryB) {
        const jurisdictionA = (a.jurisdiction ?? '').toLowerCase();
        const jurisdictionB = (b.jurisdiction ?? '').toLowerCase();
        return jurisdictionA.localeCompare(jurisdictionB);
      }
      return categoryB.localeCompare(categoryA);
    });
  }, [isAtlas, isOverpass, searchTerm, source.records]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [searchTerm, source.key, pageSize]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const currentPage = Math.min(page, totalPages);
  const pagedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const locationColumnLabel =
      source.key === 'atlas-of-surveillance'
          ? 'Description'
          : isOverpass
              ? 'Details'
              : 'Location';

  const homepageLink =
      source.key === 'redlightcameralist' ? undefined : source.homepage;

  const hasMatches = filteredRecords.length > 0;
  const rangeStart = hasMatches ? (currentPage - 1) * pageSize + 1 : 0;
  const rangeEnd = hasMatches ? rangeStart + pagedRecords.length - 1 : 0;
  const isFiltered = searchTerm.trim().length > 0;
  const highlightCards = useMemo(() => {
    if (!isPrioritySource) {
      return null;
    }
    return [
      {
        label: 'Records tracked',
        value: source.records.length.toLocaleString(),
        caption: 'Live entries',
      },
      {
        label: 'Last ingest',
        value: formatDate(source.lastIngestedAt ?? source.snapshot.createdAt),
        caption: source.lastIngestedAt ? 'Auto-updated' : 'Snapshot timestamp',
      },
    ];
  }, [
    isPrioritySource,
    source.lastIngestedAt,
    source.records.length,
    source.snapshot.createdAt,
  ]);

  const pagedRecordViews = pagedRecords.map((record) => {
    const isSelected = allowSelection && record.uid === selectedRecordId;
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
      categoryLabel: formatCategory(record.category),
      metaItems,
    };
  });

  return (
    <article className={sourceCardClassNames.join(' ')} id={`source-${source.key}`}>
        <header className="source-header">
          <h2>{source.title}</h2>
          <div className="source-meta">
            <span>{formatCount(source.totalRecords ?? source.records.length)} records</span>
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

      {highlightCards ? (
        <div className="source-mobile-highlight">
          {highlightCards.map((card) => (
            <div className="source-mobile-highlight-card" key={card.label}>
              <span className="source-mobile-highlight-label">{card.label}</span>
              <strong>{card.value}</strong>
              {card.caption ? (
                <span className="source-mobile-highlight-caption">{card.caption}</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

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

        <div className="records-scroll">
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
            pagedRecordViews.map(({ record, isSelected, tableLocationContent, categoryClassName, categoryLabel }) => {
              const rowClassNames = ['records-row'];
              if (isSelected) {
                rowClassNames.push('records-row-selected');
              }
              if (!allowSelection) {
                rowClassNames.push('records-row-disabled');
              }
              const handleRowClick = allowSelection
                ? () => {
                    onSelectRecord(record);
                  }
                : undefined;
              const handleRowKeyDown = allowSelection
                ? (event: KeyboardEvent<HTMLTableRowElement>) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectRecord(record);
                    }
                  }
                : undefined;
              return (
                <tr
                  aria-selected={allowSelection ? isSelected : undefined}
                  aria-disabled={!allowSelection || undefined}
                  className={rowClassNames.join(' ')}
                  key={record.uid}
                  onClick={handleRowClick}
                  onKeyDown={handleRowKeyDown}
                  role="row"
                  tabIndex={allowSelection ? 0 : undefined}
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
              );
            })
          ) : (
              <tr>
                <td className="records-empty" colSpan={3}>
                  No records match the current search.
                </td>
              </tr>
          )}
          </tbody>
        </table>
        </div>

        <div className="records-list" role="list">
        {pagedRecordViews.length > 0 ? (
          pagedRecordViews.map(
            ({ record, isSelected, cardLocationContent, categoryClassName, categoryLabel, metaItems }) => {
              const cardClassNames = ['record-card'];
              if (isSelected) {
                cardClassNames.push('record-card-selected');
              }
              if (!allowSelection) {
                cardClassNames.push('record-card-disabled');
              }
              const handleCardClick = allowSelection
                ? () => {
                    onSelectRecord(record);
                  }
                : undefined;
              const handleCardKeyDown = allowSelection
                ? (event: KeyboardEvent<HTMLElement>) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectRecord(record);
                    }
                  }
                : undefined;
              return (
                <article
                  className={cardClassNames.join(' ')}
                  key={`${record.uid}-card`}
                  onClick={handleCardClick}
                  onKeyDown={handleCardKeyDown}
                  role={allowSelection ? 'button' : undefined}
                  tabIndex={allowSelection ? 0 : undefined}
                  aria-pressed={allowSelection ? isSelected : undefined}
                  aria-disabled={!allowSelection || undefined}
                >
                  {isPrioritySource ? (
          <>
            <div className="record-card-featured-header">
              <div className="record-card-featured-jurisdiction">
                <span className="record-card-featured-label">Jurisdiction</span>
                <span className="record-card-featured-title">{record.jurisdiction ?? '—'}</span>
              </div>
            </div>
                      <div className="record-card-featured-detail">
                        <span className="record-card-featured-label">{locationColumnLabel}</span>
                        <div className="record-card-featured-value record-card-value-rich">{cardLocationContent}</div>
                      </div>
                      {metaItems.length > 0 ? (
                        <div className="record-card-featured-meta">
                          {metaItems.map((item) => (
                            <span className="record-card-featured-meta-chip" key={item}>
                              {item}
                            </span>
                          ))}
                        </div>
                      ) : null}
            <div className="record-card-row record-card-row-inline">
              <span className="record-card-label">Category</span>
              <span className="record-card-value">
                <span className={categoryClassName}>{categoryLabel}</span>
              </span>
            </div>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </article>
              );
            },
          )
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

    const seenKeys = new Set<string>();
    const prioritized = SOURCE_RENDER_ORDER.map((key) =>
        dataset.sources.find((source) => source.key === key),
    ).filter((source): source is DatasetSource => {
      if (!source || seenKeys.has(source.key)) {
        return false;
      }
      seenKeys.add(source.key);
      return true;
    });

    const remainder = dataset.sources.filter((source) => !seenKeys.has(source.key));

    return [...prioritized, ...remainder];
  }, [dataset]);

  const mapInsertionKey = useMemo(() => {
    if (orderedSources.length === 0) {
      return undefined;
    }
    const licenseSourcePresent = orderedSources.some(
        (source) => source.key === LICENSE_SOURCE_KEY,
    );
    return licenseSourcePresent ? LICENSE_SOURCE_KEY : orderedSources[0]?.key;
  }, [orderedSources]);

  const scrollToSection = useCallback((targetId: string) => {
    if (typeof document === 'undefined') {
      return;
    }
    const target = document.getElementById(targetId);
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

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
                <SurveillanceMark className="brand-logo" />
                <div className="brand-copy">
                  <h1 className="brand">Aintivirus Surveillance Tracker</h1>
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
                <h3>Data sources</h3>
                <strong>{formatCount(totals.sourceCount)}</strong>
                <span className="metric-note">ingested on a schedule</span>
              </div>
              <div className="metric-card">
                <h3>Records tracked</h3>
                <strong>{formatCount(totals.recordCount)}</strong>
                <span className="metric-note">cameras &amp; readers on file</span>
              </div>
              <div className="metric-card">
                <h3>Last updated</h3>
                <strong className="metric-value-text" title={formatDate(lastGeneratedAt)}>
                  {formatRelative(lastGeneratedAt)}
                </strong>
                <span className="metric-note">{formatDate(lastGeneratedAt)}</span>
              </div>
            </div>
            <div className="hero-quick-links" aria-label="Quick navigation">
              <button
                  type="button"
                  className="hero-quick-link-button"
                  onClick={() => scrollToSection(SCROLL_TARGETS.redlight)}
              >
                Red-light cameras
              </button>
              <button
                  type="button"
                  className="hero-quick-link-button"
                  onClick={() => scrollToSection(SCROLL_TARGETS.license)}
              >
                License plate readers
              </button>
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
                    <>
                      <section className="sources-grid">
                        {orderedSources.map((source) => (
                            <SourceCard
                                key={source.key}
                                onSelectRecord={handleSelectRecord}
                                selectedRecordId={selectedRecord?.uid}
                                source={source}
                            />
                        ))}
                      </section>
                      {/* Full-width: the map is the payoff for selecting a row,
                          and a half-column of world map is unreadable. */}
                      <InteractiveMap ref={mapPanelRef} record={selectedRecord} />
                    </>
                ) : (
                    <div className="empty-state">
                      No datasets available yet. Run the ingestion engine to populate the tracker.
                    </div>
                )
            ) : null}

            <ThreatMapEmbed />
            <GlobalThreatIntelligence />
          </main>

          <FrameStrip />
          <Footer />
        </div>
      </>
  );
}

export default App;