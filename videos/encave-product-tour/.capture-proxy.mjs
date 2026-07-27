// Local plain-HTTP relay so headless Chrome (which cannot validate TLS through
// this sandbox's egress proxy) can browse a real HTTPS site. Node's own https
// client already trusts the proxy's CA via NODE_EXTRA_CA_CERTS, so this
// process does the real TLS-verified fetch and hands Chrome plain HTTP back
// on localhost. Used only for local capture/screenshot purposes.
import http from 'node:http';
import https from 'node:https';

const TARGET_HOST = process.env.PROXY_TARGET_HOST || 'encave-dev.vercel.app';
const LOCAL_PORT = Number(process.env.PROXY_LOCAL_PORT || 4100);
const LOCAL_ORIGIN = `http://127.0.0.1:${LOCAL_PORT}`;
const TARGET_ORIGIN = `https://${TARGET_HOST}`;

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'strict-transport-security',
  'content-security-policy',
  'content-security-policy-report-only',
]);

function rewriteBody(buf, contentType) {
  if (!contentType || !/text|html|javascript|json|css/.test(contentType)) return buf;
  const str = buf.toString('utf-8');
  const rewritten = str.split(TARGET_ORIGIN).join(LOCAL_ORIGIN);
  return Buffer.from(rewritten, 'utf-8');
}

const server = http.createServer((req, res) => {
  const targetUrl = TARGET_ORIGIN + req.url;
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const headers = { ...req.headers };
    headers.host = TARGET_HOST;
    delete headers['accept-encoding']; // ask upstream for uncompressed so we can text-rewrite bodies safely
    delete headers['content-length'];
    // Some server-side auth checks (origin/CSRF validation) compare these against
    // the real deployed host; rewrite so the app doesn't see the local relay origin.
    if (headers.origin) headers.origin = TARGET_ORIGIN;
    if (headers.referer) headers.referer = headers.referer.split(LOCAL_ORIGIN).join(TARGET_ORIGIN);
    // `__Secure-`/`__Host-` cookie name prefixes are browser-enforced: a cookie
    // with that name is only ever stored/sent over a secure (https) context, so
    // the browser drops it entirely on this plain-http relay. We hand the
    // browser an unprefixed alias (see response side below); restore the
    // prefixed name(s) here so the upstream app still finds its own cookie.
    if (headers.cookie) {
      const pairs = headers.cookie.split(';').map((p) => p.trim()).filter(Boolean);
      const extra = [];
      for (const pair of pairs) {
        const eq = pair.indexOf('=');
        if (eq === -1) continue;
        const name = pair.slice(0, eq);
        const value = pair.slice(eq + 1);
        if (!name.startsWith('__Secure-') && !name.startsWith('__Host-')) {
          extra.push(`__Secure-${name}=${value}`, `__Host-${name}=${value}`);
        }
      }
      headers.cookie = [...pairs, ...extra].join('; ');
    }

    const upstreamReq = https.request(
      targetUrl,
      { method: req.method, headers },
      (upstreamRes) => {
        const outHeaders = {};
        for (const [k, v] of Object.entries(upstreamRes.headers)) {
          if (HOP_BY_HOP.has(k.toLowerCase())) continue;
          if (k.toLowerCase() === 'location' && typeof v === 'string') {
            outHeaders[k] = v.split(TARGET_ORIGIN).join(LOCAL_ORIGIN);
            continue;
          }
          if (k.toLowerCase() === 'set-cookie') {
            const arr = Array.isArray(v) ? v : [v];
            const out = [];
            for (const cookieStr of arr) {
              out.push(cookieStr.replace(/;\s*Secure/gi, ''));
              const eq = cookieStr.indexOf('=');
              const name = eq === -1 ? '' : cookieStr.slice(0, eq);
              if (name.startsWith('__Secure-') || name.startsWith('__Host-')) {
                const bareName = name.replace(/^__(Secure|Host)-/, '');
                out.push(bareName + cookieStr.slice(eq).replace(/;\s*Secure/gi, ''));
              }
            }
            outHeaders[k] = out;
            continue;
          }
          outHeaders[k] = v;
        }
        const upChunks = [];
        upstreamRes.on('data', (c) => upChunks.push(c));
        upstreamRes.on('end', () => {
          const buf = Buffer.concat(upChunks);
          const rewritten = rewriteBody(buf, outHeaders['content-type']);
          outHeaders['content-length'] = rewritten.length;
          res.writeHead(upstreamRes.statusCode || 200, outHeaders);
          res.end(rewritten);
        });
      }
    );
    upstreamReq.on('error', (e) => {
      res.writeHead(502, { 'content-type': 'text/plain' });
      res.end('Upstream error: ' + e.message);
    });
    if (body.length) upstreamReq.write(body);
    upstreamReq.end();
  });
});

server.listen(LOCAL_PORT, '127.0.0.1', () => {
  console.log(`Relay up: ${LOCAL_ORIGIN} -> ${TARGET_ORIGIN}`);
});
