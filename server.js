const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Hosts we're allowed to proxy to. Populated after a successful login so
// /stream can't be used as an open relay to arbitrary URLs (basic SSRF guard).
const allowedHosts = new Set();

function normalizeServer(server) {
  let s = server.trim();
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  return s.replace(/\/+$/, '');
}

function hostOf(urlStr) {
  try { return new URL(urlStr).host; } catch { return null; }
}

// ---------- Login ----------
app.post('/api/login', async (req, res) => {
  const { server, username, password } = req.body || {};
  if (!server || !username || !password) {
    return res.status(400).json({ ok: false, error: 'Missing fields (server, username, password).' });
  }
  const base = normalizeServer(server);
  const apiUrl = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

  try {
    const r = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) {
      return res.status(502).json({ ok: false, error: `Server responded with HTTP ${r.status}.` });
    }
    const data = await r.json();
    const auth = data && data.user_info && Number(data.user_info.auth) === 1;
    if (!auth) {
      return res.status(401).json({ ok: false, error: 'Wrong server, username, or password.' });
    }
    allowedHosts.add(hostOf(base));
    res.json({ ok: true, base, user_info: data.user_info, server_info: data.server_info });
  } catch (err) {
    res.status(502).json({ ok: false, error: 'Could not connect to the server: ' + err.message });
  }
});

// ---------- Generic Xtream JSON API passthrough ----------
// GET /api/proxy?base=...&username=...&password=...&action=...&<extra params>
app.get('/api/proxy', async (req, res) => {
  const { base, username, password, action, ...rest } = req.query;
  if (!base || !username || !password) {
    return res.status(400).json({ ok: false, error: 'Missing parameters.' });
  }
  const host = hostOf(base);
  if (!allowedHosts.has(host)) {
    return res.status(403).json({ ok: false, error: 'Server not authorized. Please log in again.' });
  }
  const params = new URLSearchParams({ username, password, ...(action ? { action } : {}), ...rest });
  const apiUrl = `${base}/player_api.php?${params.toString()}`;
  try {
    const r = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
    const text = await r.text();
    res.type('application/json').status(r.status).send(text);
  } catch (err) {
    res.status(502).json({ ok: false, error: 'Error communicating with the server: ' + err.message });
  }
});

// ---------- Stream / HLS proxy ----------
// GET /stream?url=<encoded absolute url to .m3u8, .ts, or vod file>
// - Rewrites .m3u8 playlists so every segment/sub-playlist also goes through this proxy.
// - Passes through Range headers for seeking on VOD/mp4.
app.get('/stream', async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send('Missing url parameter.');
  const host = hostOf(target);
  if (!allowedHosts.has(host)) {
    return res.status(403).send('Server not authorized.');
  }

  try {
    const upstreamHeaders = {};
    if (req.headers.range) upstreamHeaders.range = req.headers.range;

    const upstream = await fetch(target, { headers: upstreamHeaders, signal: AbortSignal.timeout(20000) });

    if (!upstream.ok) {
      const bodyText = await upstream.text().catch(() => '');
      console.error(`[stream] upstream returned HTTP ${upstream.status} for ${target} :: ${bodyText.slice(0, 300)}`);
      res.status(upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502);
      res.set('Access-Control-Allow-Origin', '*');
      return res.send(`Upstream server returned HTTP ${upstream.status}. This usually means the provider is blocking or rejecting this connection (some providers block hosting/datacenter IP addresses).`);
    }

    const contentType = upstream.headers.get('content-type') || '';
    const isManifest = /mpegurl|m3u8/i.test(contentType) || target.toLowerCase().includes('.m3u8');

    if (isManifest) {
      const text = await upstream.text();
      if (!text.includes('#EXTM3U') && !text.includes('#EXT-X')) {
        console.error(`[stream] expected an m3u8 manifest from ${target} but got something else :: ${text.slice(0, 300)}`);
        res.set('Access-Control-Allow-Origin', '*');
        return res.status(502).send('The upstream server did not return a valid HLS playlist.');
      }
      const rewritten = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        const resolved = new URL(trimmed, target).toString();
        return '/stream?url=' + encodeURIComponent(resolved);
      }).join('\n');
      res.set('Content-Type', 'application/vnd.apple.mpegurl');
      res.set('Access-Control-Allow-Origin', '*');
      return res.status(200).send(rewritten);
    }

    res.status(upstream.status);
    res.set('Access-Control-Allow-Origin', '*');
    const passHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
    passHeaders.forEach(h => {
      const v = upstream.headers.get(h);
      if (v) res.set(h, v);
    });
    if (!upstream.body) return res.end();

    const reader = upstream.body.getReader();
    req.on('close', () => reader.cancel().catch(() => {}));
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    console.error(`[stream] error proxying ${target}: ${err.message}`);
    if (!res.headersSent) res.status(502).send('Error proxying the stream: ' + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Orbit TV pokrenut: http://localhost:${PORT}`);
});
