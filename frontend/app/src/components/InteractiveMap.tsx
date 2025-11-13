import { forwardRef, useEffect, useMemo } from 'react';
import type { LatLngExpression } from 'leaflet';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';

import type { DatasetRecord } from '../types';

import mapPinUrl from '../assets/map-pin.svg';

const DEFAULT_CENTER: LatLngExpression = [39.8283, -98.5795];
const DEFAULT_ZOOM = 4;
const RECORD_ZOOM = 15;

const mapPinIcon = L.icon({
  iconUrl: mapPinUrl,
  iconRetinaUrl: mapPinUrl,
  iconSize: [40, 54],
  iconAnchor: [20, 50],
  popupAnchor: [0, -42],
});

function MapViewUpdater({ position }: { position: LatLngExpression }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(position, RECORD_ZOOM, { duration: 0.75 });
  }, [map, position]);

  return null;
}

interface InteractiveMapProps {
  record: DatasetRecord | null;
}

const InteractiveMap = forwardRef<HTMLElement, InteractiveMapProps>(
  ({ record }, ref) => {
  const hasCoordinates =
    Number.isFinite(record?.latitude) && Number.isFinite(record?.longitude);
  const isOverpassRecord = Boolean(record?.uid?.startsWith('overpass-alpr-'));

  const position = useMemo<LatLngExpression | null>(() => {
    if (!hasCoordinates || record === null) {
      return null;
    }
    return [record.latitude as number, record.longitude as number];
  }, [hasCoordinates, record]);

  const overlayMessage = useMemo(() => {
    if (!record) {
      return 'Select a record to preview its location.';
    }
    if (!hasCoordinates) {
      return 'Location data is unavailable for this record.';
    }
    return null;
  }, [hasCoordinates, record]);

  const overpassTags = useMemo(() => {
    if (!isOverpassRecord || !record?.raw || typeof record.raw !== 'object') {
      return undefined;
    }
    const candidate = (record.raw as Record<string, unknown>)['tags'];
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
  }, [isOverpassRecord, record]);

  const sourceUrl = useMemo(() => {
    if (!isOverpassRecord || !record?.raw || typeof record.raw !== 'object') {
      return undefined;
    }
    const value = (record.raw as Record<string, unknown>)['sourceUrl'];
    return typeof value === 'string' ? value : undefined;
  }, [isOverpassRecord, record]);

  const coordinateLabel = useMemo(() => {
    if (!hasCoordinates || !record) {
      return undefined;
    }
    return `${(record.latitude as number).toFixed(5)}, ${(record.longitude as number).toFixed(5)}`;
  }, [hasCoordinates, record]);

  const operator = overpassTags?.operator;
  const manufacturer = overpassTags?.manufacturer;
  const direction = overpassTags?.direction;

    const highlightLabel =
      operator ?? record?.address ?? record?.jurisdiction ?? 'Selected record';

    return (
      <article className="map-panel" ref={ref}>
        <header className="map-panel-header">
          <h2>Interactive map</h2>
          {record ? (
            <span className="map-panel-subtitle">
              Highlighting: {highlightLabel}
            </span>
          ) : (
            <span className="map-panel-subtitle">
              Choose any row to highlight it on the map.
            </span>
          )}
        </header>

        <div className="map-canvas">
          <MapContainer
            center={position ?? DEFAULT_CENTER}
            className="map-container"
            aria-label="Interactive map preview"
            scrollWheelZoom
            zoom={position ? RECORD_ZOOM : DEFAULT_ZOOM}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {position ? (
              <>
                <Marker icon={mapPinIcon} position={position}>
                  <Popup>
                    <div className="map-popup">
                      {operator ? <p>{operator}</p> : null}
                      {record?.address &&
                      (!operator || operator !== record.address) ? (
                        <p>{record.address}</p>
                      ) : null}
                      {record?.jurisdiction ? (
                        <p>{record.jurisdiction}</p>
                      ) : null}
                      {record?.category ? (
                        <p className="map-popup-category">{record.category}</p>
                      ) : null}
                      {manufacturer ? <p>Manufacturer: {manufacturer}</p> : null}
                      {direction ? <p>Direction: {direction}°</p> : null}
                      {coordinateLabel ? <p>Coords: {coordinateLabel}</p> : null}
                      {sourceUrl ? (
                        <p>
                          <a href={sourceUrl} target="_blank" rel="noreferrer">
                            View on OSM
                          </a>
                        </p>
                      ) : null}
                    </div>
                  </Popup>
                </Marker>
                <MapViewUpdater position={position} />
              </>
            ) : null}
          </MapContainer>

          {overlayMessage ? (
            <div aria-live="polite" className="map-placeholder" role="status">
              <span>{overlayMessage}</span>
            </div>
          ) : null}
        </div>

        <footer className="map-panel-footer">
          {record ? (
            hasCoordinates ? (
              <>
                <strong>{highlightLabel}</strong>
                <div className="map-panel-meta">
                  {record.address &&
                  (!operator || operator !== record.address) ? (
                    <span>{record.address}</span>
                  ) : null}
                  {record.jurisdiction ? (
                    <span>{record.jurisdiction}</span>
                  ) : null}
                  {record.category ? (
                    <span className={`badge ${record.category ?? 'other'}`}>
                      {record.category}
                    </span>
                  ) : null}
                  {direction ? <span>Direction: {direction}°</span> : null}
                  {coordinateLabel ? <span>{coordinateLabel}</span> : null}
                  {sourceUrl ? (
                    <a href={sourceUrl} target="_blank" rel="noreferrer">
                      View on OSM
                    </a>
                  ) : null}
                </div>
              </>
            ) : (
              <span>
                The selected record does not include coordinate data, so it cannot be
                plotted automatically.
              </span>
            )
          ) : (
            <span>
              Select a record from any dataset to preview its mapped location.
            </span>
          )}
        </footer>
      </article>
    );
  },
);

export default InteractiveMap;

