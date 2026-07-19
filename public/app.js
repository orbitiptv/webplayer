(function () {
  const { t, applyI18n } = window.I18N;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[OrbitTV] Service worker registration failed:', err);
      });
    });
  }

  // PWA install prompt (Chrome/Edge/Android show this; Safari/iOS has no such event -
  // there we just rely on the manifest + apple-touch-icon meta tags for "Add to Home Screen").
  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById('installAppBtn');
    if (btn) btn.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const btn = document.getElementById('installAppBtn');
    if (btn) btn.hidden = true;
  });

  const state = {
    session: null,        // { base, username, password }
    mode: 'live',          // 'live' | 'movies' | 'series'
    categories: [],
    channels: [],
    vodStreams: [],
    seriesList: [],
    activeCategory: '',
    activeChannel: null,
    editingProfileId: null,
    miniHls: null,
    mainHls: null,
    mainIsLive: true,
    mainUrl: null
  };

  const PX_PER_MIN = 3;
  const DAY_WIDTH = 24 * 60 * PX_PER_MIN;

  // ================= Profile storage (localStorage) =================
  function loadProfiles() {
    try { return JSON.parse(localStorage.getItem('orbittv_profiles') || '[]'); }
    catch { return []; }
  }
  function saveProfiles(list) {
    localStorage.setItem('orbittv_profiles', JSON.stringify(list));
  }
  function newId() {
    return 'p_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function renderProfileList() {
    const list = loadProfiles();
    const wrap = document.getElementById('profileList');
    const empty = document.getElementById('profileEmpty');
    wrap.innerHTML = '';
    empty.hidden = list.length > 0;
    list.forEach(p => {
      const row = document.createElement('div');
      row.className = 'profile-row';
      row.innerHTML = `
        <div class="info">
          <div class="name"></div>
          <div class="meta"></div>
        </div>
        <div class="row-actions">
          <button class="editBtn" title="${t('edit')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20l0-4L15.5 4.5a2 2 0 012.8 0l1.2 1.2a2 2 0 010 2.8L8 20z"/><path d="M13 6l5 5"/></svg></button>
          <button class="deleteBtn" title="${t('delete')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>
        </div>`;
      row.querySelector('.name').textContent = p.name;
      row.querySelector('.meta').textContent = `${p.username} \u00b7 ${p.server}`;
      row.addEventListener('click', (e) => {
        if (e.target.closest('.row-actions')) return;
        loginWithProfile(p, row);
      });
      row.querySelector('.editBtn').addEventListener('click', () => openProfileForm(p));
      row.querySelector('.deleteBtn').addEventListener('click', () => {
        if (confirm(t('delete_profile_confirm'))) {
          saveProfiles(loadProfiles().filter(x => x.id !== p.id));
          renderProfileList();
        }
      });
      wrap.appendChild(row);
    });
  }

  function openProfileForm(profile) {
    state.editingProfileId = profile ? profile.id : null;
    document.getElementById('profileFormTitle').textContent = profile ? t('edit_profile_title') : t('add_profile_button');
    document.getElementById('fName').value = profile ? profile.name : '';
    document.getElementById('fServer').value = profile ? profile.server : '';
    document.getElementById('fUser').value = profile ? profile.username : '';
    document.getElementById('fPass').value = profile ? profile.password : '';
    document.getElementById('formError').hidden = true;
    document.getElementById('profileFormModal').hidden = false;
  }
  function closeProfileForm() {
    document.getElementById('profileFormModal').hidden = true;
  }

  async function saveProfileForm() {
    const name = document.getElementById('fName').value.trim();
    const server = document.getElementById('fServer').value.trim();
    const user = document.getElementById('fUser').value.trim();
    const pass = document.getElementById('fPass').value.trim();
    const errEl = document.getElementById('formError');
    if (!server || !user || !pass) {
      errEl.textContent = t('fill_all_fields'); errEl.hidden = false; return;
    }
    const saveBtn = document.getElementById('formSaveBtn');
    saveBtn.disabled = true; saveBtn.textContent = t('connecting');
    try {
      const r = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server, username: user, password: pass })
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || t('wrong_credentials'));

      const list = loadProfiles();
      const id = state.editingProfileId || newId();
      const profile = { id, name: name || user, server: data.base, username: user, password: pass };
      const idx = list.findIndex(p => p.id === id);
      if (idx >= 0) list[idx] = profile; else list.push(profile);
      saveProfiles(list);
      closeProfileForm();
      renderProfileList();
    } catch (err) {
      console.error('[OrbitTV] Save profile failed:', err);
      errEl.textContent = (err instanceof TypeError)
        ? 'Cannot reach the app server. Make sure you started it with "npm start" and opened this page at http://localhost:3000 (not by double-clicking index.html).'
        : err.message;
      errEl.hidden = false;
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = t('save_profile_button');
    }
  }

  async function loginWithProfile(profile, rowEl) {
    const errBanner = document.getElementById('profileScreenError');
    errBanner.hidden = true;

    const nameEl = rowEl ? rowEl.querySelector('.name') : null;
    const originalName = nameEl ? nameEl.textContent : '';
    if (rowEl) { rowEl.style.opacity = '0.6'; rowEl.style.pointerEvents = 'none'; }
    if (nameEl) nameEl.textContent = t('connecting');

    try {
      const r = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server: profile.server, username: profile.username, password: profile.password })
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || t('login_failed_profile'));
      state.session = { base: data.base, username: profile.username, password: profile.password };
      document.getElementById('profileScreen').hidden = true;
      document.getElementById('app').hidden = false;
      initApp();
    } catch (err) {
      console.error('[OrbitTV] Login failed:', err);
      let message = err.message;
      if (err instanceof TypeError) {
        // fetch() itself failed - almost always means the Node server isn't running,
        // or the page was opened as a file:// path instead of http://localhost:3000
        message = 'Cannot reach the app server. Make sure you started it with "npm start" and opened this page at http://localhost:3000 (not by double-clicking index.html).';
      }
      errBanner.textContent = message;
      errBanner.hidden = false;
      if (rowEl) { rowEl.style.opacity = ''; rowEl.style.pointerEvents = ''; }
      if (nameEl) nameEl.textContent = originalName;
    }
  }

  function logout() {
    if (state.miniHls) { state.miniHls.destroy(); state.miniHls = null; }
    state.session = null;
    document.getElementById('app').hidden = true;
    document.getElementById('profileScreen').hidden = false;
    renderProfileList();
  }

  // ================= Generic Xtream API proxy call =================
  async function apiProxy(action, extra) {
    const params = new URLSearchParams({
      base: state.session.base, username: state.session.username, password: state.session.password,
      ...(action ? { action } : {}), ...(extra || {})
    });
    const r = await fetch('/api/proxy?' + params.toString());
    if (!r.ok) throw new Error('API error (' + r.status + ')');
    return r.json();
  }
  function proxiedStreamUrl(rawUrl) {
    return '/stream?url=' + encodeURIComponent(rawUrl);
  }
  function liveUrl(streamId) {
    const s = state.session;
    return `${s.base}/live/${s.username}/${s.password}/${streamId}.m3u8`;
  }
  function vodUrl(streamId, ext) {
    const s = state.session;
    return `${s.base}/movie/${s.username}/${s.password}/${streamId}.${ext || 'mp4'}`;
  }
  function seriesEpUrl(episodeId, ext) {
    const s = state.session;
    return `${s.base}/series/${s.username}/${s.password}/${episodeId}.${ext || 'mp4'}`;
  }

  // ================= App init / mode switching =================
  function initApp() {
    tickClock(); setInterval(tickClock, 30000);
    switchMode('live');
  }

  function switchMode(mode) {
    state.mode = mode;
    document.getElementById('navLive').classList.toggle('active', mode === 'live');
    document.getElementById('navMovies').classList.toggle('active', mode === 'movies');
    document.getElementById('navSeries').classList.toggle('active', mode === 'series');

    document.getElementById('liveView').hidden = mode !== 'live';
    document.getElementById('gridView').hidden = mode === 'live';
    document.getElementById('miniCtrlBar').hidden = mode !== 'live';
    document.getElementById('gridSectionLabel').textContent = mode === 'movies' ? t('nav_movies') : t('nav_series');

    if (mode !== 'live' && state.miniHls) { state.miniHls.destroy(); state.miniHls = null; }
    if (mode === 'live' && state.activeChannel) playMini(state.activeChannel);

    loadCategories();
  }

  async function loadCategories() {
    const catList = document.getElementById('catList');
    catList.innerHTML = '';
    try {
      const action = state.mode === 'live' ? 'get_live_categories' : state.mode === 'movies' ? 'get_vod_categories' : 'get_series_categories';
      const cats = await apiProxy(action);
      state.categories = Array.isArray(cats) ? cats : [];
      const allLabel = state.mode === 'live' ? t('all_channels') : t('all_label');
      const allItem = makeCatItem({ category_id: '', category_name: allLabel }, true);
      catList.appendChild(allItem);
      state.categories.forEach(c => catList.appendChild(makeCatItem(c, false)));
      selectCategory('', allItem);
    } catch (err) {
      showStatus(t('error_prefix', err.message));
    }
  }

  function makeCatItem(cat, isActive) {
    const el = document.createElement('div');
    el.className = 'cat-item' + (isActive ? ' active' : '');
    el.textContent = cat.category_name;
    el.onclick = () => selectCategory(cat.category_id, el);
    return el;
  }

  function selectCategory(categoryId, el) {
    document.querySelectorAll('.cat-item').forEach(n => n.classList.remove('active'));
    if (el) el.classList.add('active');
    state.activeCategory = categoryId;
    if (state.mode === 'live') loadChannels(categoryId);
    else if (state.mode === 'movies') loadMovies(categoryId);
    else loadSeries(categoryId);
  }

  function showStatus(text) {
    const el = document.getElementById('statusText');
    el.textContent = text; el.hidden = false;
  }
  function hideStatus() { document.getElementById('statusText').hidden = true; }

  // ================= LIVE TV =================
  async function loadChannels(categoryId) {
    hideStatus();
    try {
      const extra = categoryId ? { category_id: categoryId } : {};
      const streams = await apiProxy('get_live_streams', extra);
      state.channels = Array.isArray(streams) ? streams : [];
      renderChannelRail();
      renderEPG();
      setTimeout(scrollEpgToNow, 100);
      if (state.channels.length) selectChannel(state.channels[0]);
      else showStatus(t('no_channels_category'));
    } catch (err) {
      showStatus(t('error_prefix', err.message));
    }
  }

  function logoOrFallback(ch, size) {
    if (ch.stream_icon) return `<img src="${ch.stream_icon}" width="${size}" height="${size}" onerror="this.style.visibility='hidden'">`;
    return `<div style="width:${size}px;height:${size}px;background:var(--surf3);border-radius:5px"></div>`;
  }

  function renderChannelRail() {
    const rail = document.getElementById('chRail');
    rail.innerHTML = '';
    state.channels.forEach(ch => {
      const tile = document.createElement('div');
      tile.className = 'chtile' + (state.activeChannel && state.activeChannel.stream_id === ch.stream_id ? ' active' : '');
      tile.innerHTML = `${logoOrFallback(ch, 24)}<div class="name">${ch.name}</div>`;
      tile.onclick = () => selectChannel(ch);
      rail.appendChild(tile);
    });
  }

  function b64(str) { try { return decodeURIComponent(escape(atob(str))); } catch { return str || ''; } }
  function minutesOfDay(ts) { const d = new Date(ts * 1000); return d.getHours() * 60 + d.getMinutes(); }
  function fmtHM(ts) { const d = new Date(ts * 1000); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  function renderEPG() {
    const grid = document.getElementById('epgGrid');
    grid.innerHTML = '';
    if (!state.channels.length) return;

    const ruler = document.createElement('div');
    ruler.className = 'epg-ruler';
    ruler.innerHTML = '<div class="corner"></div>';
    for (let h = 0; h < 24; h++) {
      const hr = document.createElement('div');
      hr.className = 'hr'; hr.style.width = (60 * PX_PER_MIN) + 'px';
      hr.textContent = String(h).padStart(2, '0') + ':00';
      ruler.appendChild(hr);
    }
    grid.appendChild(ruler);

    const rows = document.createElement('div');
    rows.className = 'epg-rows';
    state.channels.slice(0, 25).forEach(ch => {
      const row = document.createElement('div');
      row.className = 'epg-row';
      row.innerHTML = `<div class="epg-chinfo">${logoOrFallback(ch, 22)}<div class="n">${ch.name}</div></div><div class="epg-events" style="width:${DAY_WIDTH}px"><span class="noinfo">${t('loading_program')}</span></div>`;
      row.querySelector('.epg-chinfo').onclick = () => selectChannel(ch);
      rows.appendChild(row);
      loadShortEpg(ch, row.querySelector('.epg-events'));
    });
    grid.appendChild(rows);

    const nowLine = document.createElement('div');
    nowLine.className = 'now-line';
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    nowLine.style.left = (160 + nowMin * PX_PER_MIN) + 'px';
    nowLine.innerHTML = '<div class="now-dot-wrap"><div class="ring2"></div><div class="core2"></div><div class="sat2"></div></div>';
    grid.appendChild(nowLine);
  }

  async function loadShortEpg(ch, container) {
    try {
      const data = await apiProxy('get_short_epg', { stream_id: ch.stream_id, limit: 20 });
      const listings = data && data.epg_listings ? data.epg_listings : [];
      if (!listings.length) { container.innerHTML = `<span class="noinfo">${t('no_program_info')}</span>`; return; }
      const now = Date.now() / 1000;
      container.innerHTML = '';
      listings.forEach(ev => {
        const start = Number(ev.start_timestamp), stop = Number(ev.stop_timestamp);
        const durMin = Math.max(5, (stop - start) / 60);
        const isNow = now >= start && now < stop;
        const el = document.createElement('div');
        el.className = 'epg-evt' + (isNow ? ' now' : '');
        el.style.width = (durMin * PX_PER_MIN) + 'px';
        el.innerHTML = `<div class="t">${b64(ev.title || '')}</div><div class="h">${fmtHM(start)} \u2013 ${fmtHM(stop)}</div>`;
        el.onclick = () => selectChannel(ch);
        container.appendChild(el);
      });
    } catch { container.innerHTML = `<span class="noinfo">${t('epg_unavailable')}</span>`; }
  }

  function scrollEpgToNow() {
    const scroll = document.getElementById('epgScroll');
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    scroll.scrollLeft = Math.max(0, 160 + nowMin * PX_PER_MIN - 300);
  }

  function selectChannel(ch) {
    state.activeChannel = ch;
    renderChannelRail();

    document.getElementById('npCat').textContent = t('nav_live');
    document.getElementById('npCh').textContent = ch.name;
    document.getElementById('npTitle').textContent = t('loading_program');
    document.getElementById('npTime').textContent = '';
    document.getElementById('npProgress').style.width = '0%';
    document.getElementById('barTitle').textContent = ch.name;
    document.getElementById('barSub').textContent = t('nav_live');

    playMini(ch);
    document.getElementById('expandBtn').onclick = () => openFullPlayer(liveUrl(ch.stream_id), ch.name, true);

    updateCurrentEpgFor(ch);
  }

  async function updateCurrentEpgFor(ch) {
    try {
      const data = await apiProxy('get_short_epg', { stream_id: ch.stream_id, limit: 2 });
      const listings = data && data.epg_listings ? data.epg_listings : [];
      if (!listings.length) { document.getElementById('npTitle').textContent = t('no_program_info'); return; }
      const now = Date.now() / 1000;
      const cur = listings.find(e => now >= Number(e.start_timestamp) && now < Number(e.stop_timestamp)) || listings[0];
      const next = listings[listings.indexOf(cur) + 1];
      const start = Number(cur.start_timestamp), stop = Number(cur.stop_timestamp);
      const pct = Math.min(100, Math.max(0, Math.round(((now - start) / (stop - start)) * 100)));
      document.getElementById('npTitle').textContent = b64(cur.title || ch.name);
      document.getElementById('npDesc').textContent = b64(cur.description || '');
      document.getElementById('npTime').textContent = fmtHM(start) + ' \u2013 ' + fmtHM(stop);
      document.getElementById('npProgress').style.width = pct + '%';
      document.getElementById('npNext').textContent = next ? b64(next.title || '') : '-';
    } catch { document.getElementById('npTitle').textContent = t('epg_unavailable'); }
  }

  function playMini(ch) {
    if (state.miniHls) { state.miniHls.destroy(); state.miniHls = null; }
    const video = document.getElementById('miniVideo');
    const url = proxiedStreamUrl(liveUrl(ch.stream_id));
    if (window.Hls && Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 20 });
      state.miniHls = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (evt, data) => {
        console.error('[OrbitTV] mini player HLS error:', data);
        if (data.fatal) showStatus(t('error_prefix', data.details || 'stream playback error'));
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url; video.play().catch(() => {});
    } else {
      console.error('[OrbitTV] HLS not supported: hls.js missing/unsupported and no native HLS in this browser.');
      showStatus('This browser cannot play HLS video (hls.js failed to load or is unsupported).');
    }
  }

  // ================= MOVIES =================
  async function loadMovies(categoryId) {
    hideStatus();
    try {
      const extra = categoryId ? { category_id: categoryId } : {};
      const streams = await apiProxy('get_vod_streams', extra);
      state.vodStreams = Array.isArray(streams) ? streams : [];
      renderPosterGrid(state.vodStreams.map(v => ({ id: v.stream_id, title: v.name, img: v.stream_icon })), (item) => {
        const vod = state.vodStreams.find(v => v.stream_id === item.id);
        openFullPlayer(proxiedStreamUrl(vodUrl(vod.stream_id, vod.container_extension)), vod.name, false);
      });
      if (!state.vodStreams.length) showStatus(t('no_movies_category'));
    } catch (err) {
      showStatus(t('error_prefix', err.message));
    }
  }

  // ================= SERIES =================
  async function loadSeries(categoryId) {
    hideStatus();
    try {
      const extra = categoryId ? { category_id: categoryId } : {};
      const list = await apiProxy('get_series', extra);
      state.seriesList = Array.isArray(list) ? list : [];
      renderPosterGrid(state.seriesList.map(s => ({ id: s.series_id, title: s.name, img: s.cover })), (item) => {
        const series = state.seriesList.find(s => s.series_id === item.id);
        openSeriesDetail(series);
      });
      if (!state.seriesList.length) showStatus(t('no_series_category'));
    } catch (err) {
      showStatus(t('error_prefix', err.message));
    }
  }

  function renderPosterGrid(items, onClick) {
    const grid = document.getElementById('posterGrid');
    grid.innerHTML = '';
    items.forEach(item => {
      const tile = document.createElement('div');
      tile.className = 'poster-tile';
      tile.innerHTML = `<div class="poster-card">${item.img ? `<img src="${item.img}" loading="lazy">` : ''}</div><div class="poster-title">${item.title || ''}</div>`;
      tile.onclick = () => onClick(item);
      grid.appendChild(tile);
    });
  }

  async function openSeriesDetail(series) {
    document.getElementById('seriesDetailOverlay').hidden = false;
    document.getElementById('seriesTitle').textContent = series.name || '';
    document.getElementById('seriesCover').src = series.cover || '';
    document.getElementById('seriesGenre').textContent = '';
    document.getElementById('seriesPlot').textContent = series.plot || '';
    const episodeList = document.getElementById('episodeList');
    episodeList.innerHTML = `<div class="status-text">${t('loading_program')}</div>`;

    try {
      const info = await apiProxy('get_series_info', { series_id: series.series_id });
      document.getElementById('seriesGenre').textContent = (info.info && info.info.genre) || '';
      document.getElementById('seriesPlot').textContent = (info.info && info.info.plot) || series.plot || '';

      episodeList.innerHTML = '';
      const episodesBySeason = info.episodes || {};
      const seasons = Object.keys(episodesBySeason).map(Number).sort((a, b) => a - b);
      if (!seasons.length) {
        episodeList.innerHTML = `<div class="status-text">${t('no_episodes')}</div>`;
        return;
      }
      seasons.forEach(season => {
        const header = document.createElement('div');
        header.className = 'season-header';
        header.textContent = t('season_label', season);
        episodeList.appendChild(header);

        const episodes = (episodesBySeason[season] || []).slice().sort((a, b) => (a.episode_num || 0) - (b.episode_num || 0));
        episodes.forEach(ep => {
          const row = document.createElement('div');
          row.className = 'episode-row';
          const label = ep.episode_num ? `${ep.episode_num}. ${ep.title || ''}` : (ep.title || '');
          row.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span class="ep-title"></span>`;
          row.querySelector('.ep-title').textContent = label;
          row.onclick = () => {
            openFullPlayer(proxiedStreamUrl(seriesEpUrl(ep.id, ep.container_extension)), ep.title || series.name, false);
          };
          episodeList.appendChild(row);
        });
      });
    } catch (err) {
      episodeList.innerHTML = `<div class="status-text">${t('error_prefix', err.message)}</div>`;
    }
  }

  // ================= FULL PLAYER MODAL =================
  const RESUME_KEY = 'orbittv_resume_positions';
  function getResumeMap() { try { return JSON.parse(localStorage.getItem(RESUME_KEY) || '{}'); } catch { return {}; } }
  function getResume(url) { return getResumeMap()[url] || 0; }
  function setResume(url, seconds) { const m = getResumeMap(); m[url] = seconds; localStorage.setItem(RESUME_KEY, JSON.stringify(m)); }
  function clearResume(url) { const m = getResumeMap(); delete m[url]; localStorage.setItem(RESUME_KEY, JSON.stringify(m)); }

  function openFullPlayer(url, title, isLive) {
    const miniVideo = document.getElementById('miniVideo');
    miniVideo.pause();

    state.mainIsLive = isLive;
    state.mainUrl = url;
    document.getElementById('playerModal').hidden = false;
    document.getElementById('playerTitle').textContent = title || '';
    document.getElementById('subtitleBtn').style.display = isLive ? 'none' : 'flex';

    const video = document.getElementById('mainVideo');
    if (state.mainHls) { state.mainHls.destroy(); state.mainHls = null; }

    if (window.Hls && Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 30 });
      state.mainHls = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!isLive) {
          const resume = getResume(url);
          if (resume > 5) video.currentTime = resume;
        }
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (evt, data) => {
        console.error('[OrbitTV] main player HLS error:', data);
        if (data.fatal) alert(t('error_prefix', data.details || 'stream playback error'));
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        if (!isLive) {
          const resume = getResume(url);
          if (resume > 5) video.currentTime = resume;
        }
      }, { once: true });
      video.play().catch(() => {});
    } else {
      console.error('[OrbitTV] HLS not supported: hls.js missing/unsupported and no native HLS in this browser.');
      alert('This browser cannot play this video (hls.js failed to load or is unsupported).');
    }
  }

  function closeFullPlayer() {
    const video = document.getElementById('mainVideo');
    if (!state.mainIsLive && state.mainUrl) {
      const dur = video.duration || 0;
      const pos = video.currentTime || 0;
      if (dur > 0 && pos < dur - 5) setResume(state.mainUrl, pos);
      else clearResume(state.mainUrl);
    }
    video.pause();
    if (state.mainHls) { state.mainHls.destroy(); state.mainHls = null; }
    video.removeAttribute('src'); video.load();
    document.getElementById('playerModal').hidden = true;

    // Back on the main menu: make sure the Live TV mini player is actually playing again
    // (it was paused, not destroyed, while the fullscreen player was open).
    if (state.mode === 'live' && state.activeChannel) {
      const miniVideo = document.getElementById('miniVideo');
      if (state.miniHls) {
        miniVideo.play().catch(() => {});
      } else {
        playMini(state.activeChannel);
      }
    }
  }

  function fmtTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  // ---- Generic popup menu ----
  function showMenu(title, options) {
    const overlay = document.getElementById('menuOverlay');
    const card = document.getElementById('menuCard');
    card.innerHTML = `<div class="menu-title"></div>`;
    card.querySelector('.menu-title').textContent = title;
    options.forEach(opt => {
      const row = document.createElement('div');
      row.className = 'menu-option' + (opt.active ? ' active' : '');
      row.textContent = opt.label;
      row.onclick = () => { opt.onClick(); overlay.hidden = true; };
      card.appendChild(row);
    });
    overlay.hidden = false;
  }
  document.getElementById('menuOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'menuOverlay') e.currentTarget.hidden = true;
  });

  function showSpeedMenu() {
    const video = document.getElementById('mainVideo');
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    showMenu(t('playback_speed'), speeds.map(s => ({
      label: s + 'x', active: video.playbackRate === s,
      onClick: () => { video.playbackRate = s; }
    })));
  }

  function showAudioTrackMenu() {
    const hls = state.mainHls;
    if (!hls || !hls.audioTracks || hls.audioTracks.length <= 1) {
      alert(t('no_audio_tracks_available')); return;
    }
    showMenu(t('audio_track'), hls.audioTracks.map((tr, i) => ({
      label: tr.name || (tr.lang ? tr.lang.toUpperCase() : t('track_fallback_label', i + 1)),
      active: hls.audioTrack === i,
      onClick: () => { hls.audioTrack = i; }
    })));
  }

  function showSubtitleMenu() {
    const hls = state.mainHls;
    if (!hls || !hls.subtitleTracks || hls.subtitleTracks.length === 0) {
      alert(t('no_subtitles_available')); return;
    }
    const options = [{
      label: t('subtitles_off'), active: hls.subtitleTrack === -1,
      onClick: () => { hls.subtitleTrack = -1; }
    }];
    hls.subtitleTracks.forEach((tr, i) => {
      options.push({
        label: tr.name || (tr.lang ? tr.lang.toUpperCase() : t('track_fallback_label', i + 1)),
        active: hls.subtitleTrack === i,
        onClick: () => { hls.subtitleTrack = i; hls.subtitleDisplay = true; }
      });
    });
    showMenu(t('subtitles'), options);
  }

  function showLanguageMenu() {
    const current = window.I18N.getLang();
    showMenu(t('choose_language'), [
      { label: t('lang_english'), active: current === 'en', onClick: () => window.I18N.setLang('en') },
      { label: t('lang_serbian'), active: current === 'sr', onClick: () => window.I18N.setLang('sr') }
    ]);
  }

  // ================= Wiring =================
  document.getElementById('addProfileBtn').onclick = () => openProfileForm(null);
  document.getElementById('installAppBtn').onclick = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    document.getElementById('installAppBtn').hidden = true;
  };
  document.getElementById('formCancelBtn').onclick = closeProfileForm;
  document.getElementById('formSaveBtn').onclick = saveProfileForm;
  document.getElementById('langBtnProfiles').onclick = showLanguageMenu;
  document.getElementById('langBtnApp').onclick = showLanguageMenu;
  document.getElementById('logoutBtn').onclick = logout;

  document.getElementById('navLive').onclick = () => switchMode('live');
  document.getElementById('navMovies').onclick = () => switchMode('movies');
  document.getElementById('navSeries').onclick = () => switchMode('series');

  document.getElementById('epgNowBtn').onclick = () => { renderEPG(); setTimeout(scrollEpgToNow, 50); };

  document.getElementById('volSlider').oninput = (e) => { document.getElementById('miniVideo').volume = e.target.value / 100; };
  document.getElementById('miniVideo').volume = 0.8;

  document.getElementById('seriesBackBtn').onclick = () => { document.getElementById('seriesDetailOverlay').hidden = true; };

  // Player modal controls
  const mainVideo = document.getElementById('mainVideo');
  document.getElementById('closePlayerBtn').onclick = closeFullPlayer;
  document.getElementById('playerBackBtn').onclick = closeFullPlayer;
  document.getElementById('speedBtn').onclick = showSpeedMenu;
  document.getElementById('audioTrackBtn').onclick = showAudioTrackMenu;
  document.getElementById('subtitleBtn').onclick = showSubtitleMenu;
  document.getElementById('seekBackBtn').onclick = () => { mainVideo.currentTime = Math.max(0, mainVideo.currentTime - 10); };
  document.getElementById('seekFwdBtn').onclick = () => { mainVideo.currentTime = mainVideo.currentTime + 10; };
  document.getElementById('playPauseBtn').onclick = () => { mainVideo.paused ? mainVideo.play() : mainVideo.pause(); };
  document.getElementById('fullscreenBtn').onclick = () => {
    const modal = document.getElementById('playerModal');
    if (modal.requestFullscreen) modal.requestFullscreen();
  };
  mainVideo.addEventListener('play', () => { document.getElementById('ppIcon').innerHTML = '<rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/>'; });
  mainVideo.addEventListener('pause', () => { document.getElementById('ppIcon').innerHTML = '<path d="M8 5v14l11-7z"/>'; });
  mainVideo.addEventListener('timeupdate', () => {
    document.getElementById('playerElapsed').textContent = fmtTime(mainVideo.currentTime);
    document.getElementById('playerDuration').textContent = isFinite(mainVideo.duration) ? fmtTime(mainVideo.duration) : '--:--';
    if (isFinite(mainVideo.duration) && mainVideo.duration > 0) {
      document.getElementById('playerSeekFill').style.width = (mainVideo.currentTime / mainVideo.duration * 100) + '%';
    }
  });
  document.getElementById('playerSeekTrack').addEventListener('click', (e) => {
    if (!isFinite(mainVideo.duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    mainVideo.currentTime = pct * mainVideo.duration;
  });

  function tickClock() {
    const d = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    document.getElementById('clockTime').textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    document.getElementById('clockDate').textContent = `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  }

  window.onLanguageChanged = function () {
    if (!document.getElementById('app').hidden) {
      document.getElementById('gridSectionLabel').textContent = state.mode === 'movies' ? t('nav_movies') : t('nav_series');
    }
  };

  // ================= Boot =================
  applyI18n();
  renderProfileList();
})();
