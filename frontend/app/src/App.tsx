import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, SVGProps } from 'react';

import { useDataset } from './hooks/useDataset';
import InteractiveMap from './components/InteractiveMap';
import ThreatMapEmbed from './components/ThreatMapEmbed';
import GlobalThreatIntelligence from './components/GlobalThreatIntelligence';
import type { DatasetRecord, DatasetSource } from './types';
import {
  getOverpassTags,
  getRecordSourceUrl,
  formatRecordCoordinates,
} from './utils/overpassTags';
import { computeTotals } from './utils/totals';

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
 * The tracker's mark: a bullet CCTV camera.
 *
 * The silhouette is Phosphor's `security-camera` in the Fill weight, not drawn
 * here. Phosphor Icons is MIT licensed, (c) 2023 Phosphor Icons —
 * https://github.com/phosphor-icons/core. Hand-drawing it produced a recognisable camera but
 * kept betraying the usual tells — a barrel that read as a box, a sunshade that
 * either fused into the housing or detached from it, foreshortening that never
 * quite resolved. Phosphor is drawn on a consistent grid by people who do this
 * full time, and the shape is simply better.
 *
 * What is ours is the articulation. The icon ships as a single flat path, so a
 * straight drop-in would be a better-drawn camera that cannot move. Splitting
 * it lets the housing pan on its bracket while the wall post stays bolted:
 *
 *   - the shared outline renders inside `.cam-pan`, clipped to x < 239 so the
 *     post is trimmed off it;
 *   - the post is then drawn once, statically, over the joint.
 *
 * The cut sits one unit inside the post's left edge and the static post is
 * widened by the same unit to overlap it. Cutting level with the edge instead
 * leaves the post's vertical boundary antialiasing into a hairline nub, and
 * cutting short of it without the overlap opens a notch in the arm.
 *
 * The pivot is the bracket joint at (244,168), a few units from that cut, so
 * the arm's cut end travels well under half a unit and stays covered.
 */
function SurveillanceMark(props: SVGProps<SVGSVGElement>) {
  const { className, ...rest } = props;
  const combinedClassName = ['surveillance-mark', className].filter(Boolean).join(' ');

  return (
    <svg
      aria-hidden="true"
      viewBox="-20 -34 296 296"
      fill="none"
      className={combinedClassName}
      {...rest}
    >
      <defs>
        {/* Deliberately applied outside `.cam-pan`. A clip nested inside the
            rotating group would swing along with it and trim nothing. */}
        <clipPath id="cam-body-clip">
          <rect x="-32" y="-48" width="271" height="352" />
        </clipPath>
      </defs>

      <g clipPath="url(#cam-body-clip)">
        <g className="cam-pan">
          <path fill="#f4f2ee" d="M248 136a8 8 0 0 0-8 8v16h-44.69L177 141.66l50.34-50.35a16 16 0 0 0 0-22.62L189.66 31l-18.35-18.31a16 16 0 0 0-22.63 0L2.92 158.94A10 10 0 0 0 10 176h39.37l35.32 35.31a16 16 0 0 0 22.62 0L165.66 153L184 171.31a15.86 15.86 0 0 0 11.31 4.69H240v16a8 8 0 0 0 16 0v-48a8 8 0 0 0-8-8M160 24l12.69 12.69L49.37 160H24.46Z" />
        </g>
      </g>

      {/* Wall post. Flat second tone rather than alpha — it overlaps the arm,
          and two translucent shapes composite into a muddy third value exactly
          where they cross. */}
      <rect x="238" y="136" width="18" height="56" rx="8" fill="#e11111" />
    </svg>
  );
}


/**
 * Case-file chrome, after stuffmonger.com: thin viewfinder brackets pinned to
 * the viewport corners, and a REC strip along the bottom — pulsing red dot,
 * typewriter case label, running timecode. Fixed and pointer-inert; it frames
 * the page without participating in layout.
 */
function CaseFrame() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - started), 1000);
    return () => window.clearInterval(id);
  }, []);

  const t = Math.floor(elapsed / 1000);
  const timecode = [
    String(Math.floor(t / 3600)).padStart(2, '0'),
    String(Math.floor((t % 3600) / 60)).padStart(2, '0'),
    String(t % 60).padStart(2, '0'),
  ].join(':');

  const caseDate = new Date().toLocaleDateString('en-US', {
    month: '2-digit', day: '2-digit', year: '2-digit',
  }).split('/').join('\u00b7');

  return (
    <div aria-hidden="true" className="case-frame">
      <span className="case-corner tl" />
      <span className="case-corner tr" />
      <span className="case-corner bl" />
      <span className="case-corner br" />
      <div className="case-strip">
        <span className="case-rec"><span className="case-rec-dot" />REC</span>
        <span className="case-label">CASE {caseDate}&nbsp;&nbsp;&nbsp;SUBJECT — SURVEILLANCE NETWORK</span>
        <span className="case-time">00:{timecode.slice(3)}:{String(elapsed % 1000).padStart(3, '0').slice(0, 2)}</span>
      </div>
    </div>
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

  const totals = useMemo(() => computeTotals(dataset), [dataset]);

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
        <CaseFrame />

        <div className="app">
          <FrameStrip />

          <header className="hero">
            <div className="hero-top">
              <div className="brand-block">
                <SurveillanceMark className="brand-logo" />
                <div className="brand-copy">
                  <h1 className="brand">Surveillance Tracker</h1>
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
        </div>
      </>
  );
}

export default App;