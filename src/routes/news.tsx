import { Hono } from 'hono'
import { fetchAllNews } from '../lib/rss'

const news = new Hono()

// ── JSON API — fetches RSS feeds server-side ───────────────────────────────
news.get('/api', async (c) => {
  try {
    const items = await fetchAllNews()
    return c.json(items)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed to fetch news' }, 500)
  }
})

// ── News Hub UI ────────────────────────────────────────────────────────────
news.get('/', (c) => {
  return c.render(
    <div class="space-y-5" id="news-hub">

      {/* ── HEADER ── */}
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-bold flex items-center gap-2">
            📰 <span>Cybersecurity News Hub</span>
          </h1>
          <p class="text-xs opacity-50 mt-0.5">Single Pane of Glass — Real-time aggregation from top security sources</p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs opacity-40 italic" id="news-last-updated">Initialising…</span>
          <button id="news-refresh-btn" class="btn btn-xs btn-outline gap-1">🔄 Refresh</button>
        </div>
      </div>

      {/* ── SOURCE STAT MINI-CARDS ── */}
      <div class="grid grid-cols-3 sm:grid-cols-5 gap-2" id="source-stats">
        {['🔐','💻','🕵️','🔒','📡'].map((icon) => (
          <div key={icon} class="skeleton h-16 rounded-lg"></div>
        ))}
      </div>

      {/* ── FILTER BAR ── */}
      <div class="flex flex-wrap gap-2 items-center">
        <select id="filter-source" class="select select-sm w-auto min-w-40">
          <option value="">All Sources</option>
          <option>The Hacker News</option>
          <option>BleepingComputer</option>
          <option>Dark Reading</option>
          <option>Krebs on Security</option>
          <option>SANS ISC</option>
        </select>
        <select id="filter-level" class="select select-sm w-auto min-w-36">
          <option value="">All Levels</option>
          <option>Critical</option>
          <option>High</option>
          <option>Medium</option>
          <option>Info</option>
        </select>
        <span class="badge badge-outline badge-sm" id="news-count">Loading…</span>
        <span id="news-cache-badge" class="hidden badge badge-success badge-sm badge-soft">⚡ Cached</span>
      </div>

      {/* ── NEWS GRID (skeleton placeholders) ── */}
      <div id="news-grid" class="grid gap-2 md:gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {[1,2,3,4,5,6].map((i) => (
          <div key={i} class="card bg-base-100 border border-base-300 shadow-sm">
            <div class="card-body gap-2 md:gap-3 p-2 md:p-4">
              <div class="skeleton h-3 w-1/3 rounded"></div>
              <div class="skeleton h-5 w-full rounded"></div>
              <div class="skeleton h-3 w-1/4 rounded"></div>
              <div class="skeleton h-14 w-full rounded"></div>
              <div class="flex gap-2 mt-1">
                <div class="skeleton h-6 w-20 rounded"></div>
                <div class="skeleton h-6 w-14 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── CLIENT-SIDE NEWS ENGINE ── */}
      <script dangerouslySetInnerHTML={{ __html: `
(function () {
  'use strict';

  /* ── constants ──────────────────────────────────────── */
  var CACHE_KEY    = 'komcad_news_v1';
  var CACHE_TS_KEY = 'komcad_news_ts';
  var TTL_MS       = 30 * 60 * 1000; // 30 minutes

  var THREAT_BADGE = { Critical:'badge-error', High:'badge-warning', Medium:'badge-info', Info:'badge-ghost' };
  var THREAT_ICON  = { Critical:'🔴', High:'🟠', Medium:'🔵', Info:'⚪' };
  var SOURCE_COLOR = {
    'The Hacker News'  :'text-error',
    'BleepingComputer' :'text-warning',
    'Dark Reading'     :'text-info',
    'Krebs on Security':'text-success',
    'SANS ISC'         :'text-secondary'
  };

  var allNews = [];

  /* ── helpers ─────────────────────────────────────────── */
  function esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function relTime(iso) {
    var d = Date.now() - new Date(iso).getTime();
    if (d < 0) return 'just now';
    var m = Math.floor(d / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return m + ' min' + (m > 1 ? 's' : '') + ' ago';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' hr'  + (h > 1 ? 's' : '') + ' ago';
    var dy = Math.floor(h / 24);
    return dy + ' day' + (dy > 1 ? 's' : '') + ' ago';
  }

  /* ── card builder ────────────────────────────────────── */
  function buildCard(item, idx) {
    var tc  = THREAT_BADGE[item.threatLevel] || 'badge-ghost';
    var ti  = THREAT_ICON[item.threatLevel]  || '⚪';
    var sc  = SOURCE_COLOR[item.source]      || '';
    return [
      '<div class="card bg-base-100 border border-base-300 shadow-sm',
      ' hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 news-card"',
      ' data-source="'+ esc(item.source) +'" data-level="'+ esc(item.threatLevel) +'">',
      '<div class="card-body gap-2 p-4">',

        /* source + threat badge */
        '<div class="flex items-center justify-between gap-2 flex-wrap">',
          '<span class="text-xs font-semibold '+ sc +' flex items-center gap-1">',
            '<span class="text-sm">'+ esc(item.sourceIcon) +'</span>',
            esc(item.source),
          '</span>',
          '<span class="badge badge-sm '+ tc +'">'+ ti +' '+ esc(item.threatLevel) +'</span>',
        '</div>',

        /* title */
        '<h3 class="font-bold text-sm leading-snug">',
          '<a href="'+ esc(item.url) +'" target="_blank" rel="noopener"',
          ' class="hover:text-primary transition-colors">'+ esc(item.title) +'</a>',
        '</h3>',

        /* timestamp */
        '<p class="text-xs opacity-40">'+ relTime(item.publishedAt) +'</p>',

        /* description */
        '<p class="text-xs opacity-70 leading-relaxed">'+ esc(item.description) +'</p>',

        /* action row */
        '<div class="card-actions justify-end items-center mt-1">',
          '<a href="'+ esc(item.url) +'" target="_blank" rel="noopener"',
          ' class="btn btn-xs btn-outline">↗ Open</a>',
        '</div>',

      '</div></div>'
    ].join('');
  }

  /* ── filter + render grid ───────────────────────────── */
  function applyFilters() {
    var srcEl = document.getElementById('filter-source');
    var lvlEl = document.getElementById('filter-level');
    var src = srcEl ? srcEl.value : '';
    var lvl = lvlEl ? lvlEl.value : '';

    var filtered = allNews.filter(function (n) {
      return (!src || n.source === src) && (!lvl || n.threatLevel === lvl);
    });

    var grid = document.getElementById('news-grid');
    if (!grid) return;

    if (filtered.length === 0) {
      grid.innerHTML = '<div class="col-span-full text-center py-16 opacity-40 text-sm">No articles match your filters.</div>';
    } else {
      grid.innerHTML = filtered.map(buildCard).join('');
    }

    var cntEl = document.getElementById('news-count');
    if (cntEl) cntEl.textContent = filtered.length + ' articles';
  }

  /* ── source stats ────────────────────────────────────── */
  function renderStats() {
    var counts = {}, icons = {};
    allNews.forEach(function (n) {
      counts[n.source] = (counts[n.source] || 0) + 1;
      icons[n.source]  = n.sourceIcon;
    });
    var el = document.getElementById('source-stats');
    if (!el) return;
    el.innerHTML = Object.keys(counts).map(function (src) {
      var short = src.split(' ').slice(-1)[0];
      return '<div class="bg-base-100 rounded-lg border border-base-300 p-2 text-center">'
        + '<div class="text-xl">'+ esc(icons[src]||'📰') +'</div>'
        + '<div class="text-xs opacity-50 truncate leading-tight">'+ esc(short) +'</div>'
        + '<div class="font-bold text-sm text-primary">'+ counts[src] +'</div>'
        + '</div>';
    }).join('');
  }

  /* ── localStorage cache (30 min TTL) ────────────────── */
  function getCached() {
    try {
      var ts = localStorage.getItem(CACHE_TS_KEY);
      var d  = localStorage.getItem(CACHE_KEY);
      if (ts && d && (Date.now() - parseInt(ts, 10)) < TTL_MS) return JSON.parse(d);
    } catch(e) {}
    return null;
  }
  function setCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
    } catch(e) {}
  }
  function clearCache() {
    try { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(CACHE_TS_KEY); } catch(e) {}
  }

  /* ── UI helpers ──────────────────────────────────────── */
  function setUpdatedLabel(fromCache) {
    var el = document.getElementById('news-last-updated');
    var now = new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
    if (el) el.textContent = 'Updated at '+ now + (fromCache ? ' (cached)' : '');
    var badge = document.getElementById('news-cache-badge');
    if (badge) badge.classList.toggle('hidden', !fromCache);
  }
  function showSkeletons() {
    var g = document.getElementById('news-grid');
    if (!g) return;
    var sk = '';
    for (var i = 0; i < 6; i++) {
      sk += '<div class="card bg-base-100 border border-base-300 shadow-sm">'
          + '<div class="card-body gap-2 md:gap-3 p-2 md:p-4">'
          + '<div class="skeleton h-3 w-1/3 rounded"></div>'
          + '<div class="skeleton h-5 w-full rounded"></div>'
          + '<div class="skeleton h-3 w-1/4 rounded"></div>'
          + '<div class="skeleton h-14 w-full rounded"></div>'
          + '<div class="flex gap-2 mt-1">'
          + '<div class="skeleton h-6 w-20 rounded"></div>'
          + '<div class="skeleton h-6 w-14 rounded"></div>'
          + '</div></div></div>';
    }
    g.innerHTML = sk;
  }

  /* ── main fetch flow ─────────────────────────────────── */
  function loadNews(force) {
    if (!force) {
      var cached = getCached();
      if (cached) { allNews = cached; renderStats(); applyFilters(); setUpdatedLabel(true); return; }
    }
    showSkeletons();
    var cntEl = document.getElementById('news-count');
    if (cntEl) cntEl.textContent = 'Fetching…';

    fetch('/news/api')
      .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function(data) {
        setCache(data);
        allNews = data;
        renderStats();
        applyFilters();
        setUpdatedLabel(false);
      })
      .catch(function(err) {
        var g = document.getElementById('news-grid');
        if (g) g.innerHTML = '<div class="col-span-full"><div role="alert" class="alert alert-error alert-soft">'
          + '⚠️ Failed to load news: '+ esc(String(err))
          + '. <button onclick="window.__newsHubRefresh()" class="btn btn-xs btn-error ml-2">Retry</button>'
          + '</div></div>';
        var cntEl2 = document.getElementById('news-count');
        if (cntEl2) cntEl2.textContent = 'Error';
      });
  }

  /* ── public refresh ──────────────────────────────────── */
  window.__newsHubRefresh = function () { clearCache(); loadNews(true); };

  /* ── bind controls ───────────────────────────────────── */
  function bindControls() {
    var rb  = document.getElementById('news-refresh-btn');
    var sf  = document.getElementById('filter-source');
    var lf  = document.getElementById('filter-level');
    if (rb) rb.addEventListener('click', function() { clearCache(); loadNews(true); });
    if (sf) sf.addEventListener('change', applyFilters);
    if (lf) lf.addEventListener('change', applyFilters);
  }

  /* ── boot ────────────────────────────────────────────── */
  function init() { bindControls(); loadNews(false); }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
      ` }} />
    </div>,
    // @ts-expect-error
    { title: 'News Hub' }
  )
})

export default news
