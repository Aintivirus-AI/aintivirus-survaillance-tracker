/**
 * Authenticated write surface for the nightly ingestion job.
 *
 *   PUT /api/internal/dataset   — store the freshly built latest.json
 *   GET /api/internal/geocache  — fetch the Nominatim geocode cache
 *   PUT /api/internal/geocache  — store the updated geocode cache
 *
 * Auth is a single bearer secret (INGEST_TOKEN, a Pages secret) compared in
 * constant time. The dataset key is fixed — the caller cannot choose object
 * names, so a leaked token can overwrite the dataset but cannot touch anything
 * else in the bucket or account.
 */
const OBJECTS = {
  dataset: 'latest.json',
  geocache: 'geocode-cache.json',
};

// 200 MB — the dataset is ~40 MB; headroom without being a free-for-all.
const MAX_BODY_BYTES = 200 * 1024 * 1024;

function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

export async function onRequest(context) {
  const { request, env, params } = context;

  const expected = env.INGEST_TOKEN;
  if (!expected) {
    return new Response('Ingestion is not configured', { status: 500 });
  }

  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !timingSafeEqual(token, expected)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const segments = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const key = OBJECTS[segments[0]];
  if (segments.length !== 1 || !key) {
    return new Response('Not found', { status: 404 });
  }

  if (request.method === 'GET') {
    const object = await env.tracker_data.get(key);
    if (!object) return new Response('Not found', { status: 404 });
    return new Response(object.body, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (request.method === 'PUT') {
    const length = Number(request.headers.get('content-length') ?? '0');
    if (length > MAX_BODY_BYTES) {
      return new Response('Payload too large', { status: 413 });
    }
    await env.tracker_data.put(key, request.body, {
      httpMetadata: { contentType: 'application/json' },
    });
    return new Response(JSON.stringify({ stored: key }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  return new Response('Method not allowed', {
    status: 405,
    headers: { Allow: 'GET, PUT' },
  });
}
