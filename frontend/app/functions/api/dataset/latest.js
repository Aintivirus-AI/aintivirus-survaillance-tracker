/**
 * Serves the published dataset out of R2.
 *
 * The old deployment kept a NestJS server alive on a VM to serve one JSON
 * document. Now a nightly GitHub Action builds the dataset and PUTs it here
 * (see functions/api/internal/), this Function serves it, and there is no
 * server to die, fill its disk, or get suspended.
 *
 * The document is ~40 MB, so caching is load-bearing: strong ETag from R2 and
 * a short edge TTL make repeat loads 304s rather than full transfers. The
 * frontend already sends If-None-Match.
 */
export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.tracker_data) {
    return json({ error: 'Dataset storage is not configured' }, 500);
  }

  const object = await env.tracker_data.get('latest.json');
  if (!object) {
    return json(
      { error: 'No dataset has been published yet. The nightly ingestion has not run.' },
      404,
    );
  }

  const etag = object.httpEtag;
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, {
      status: 304,
      headers: { etag, 'cache-control': 'public, max-age=300' },
    });
  }

  return new Response(object.body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      etag,
      'cache-control': 'public, max-age=300',
      'access-control-allow-origin': '*',
    },
  });
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
