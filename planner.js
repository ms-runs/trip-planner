// Trip planner engine. Everything about a particular trip (stops, map, travel modes,
// categories, colours, ideas) lives in trips/<id>/trip.js and trips/<id>/basemap.js;
// shared settings live in config.js. This file shouldn't need editing for a new trip.
'use strict';

// ═══ 1. SETTINGS (from config.js) ═════════════════════════════════════════════
const CONFIG = {supabaseUrl: '', supabaseKey: '', resolverUrl: '', ...(window.PLANNER_CONFIG || {})};
// The shared trip is chosen by the link: https://…/?trip=folder#trip=some-long-secret
const TRIP_KEY = new URLSearchParams(location.hash.slice(1)).get('trip') || '';
const REMOTE = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseKey && TRIP_KEY.length >= 12);  // codes under 12 characters are refused by the database
const T = window.TRIP, BASE = window.BASEMAP;
T.id = window.TRIP_ID || T.id;   // the folder name, so a copied trip.js can't share saved data with its original

// ═══ 2. MAP PROJECTION ════════════════════════════════════════════════════════
// Plain Mercator, fitted so the basemap's bounds fill a 1000-unit-wide map.
const [B_S, B_W, B_N, B_E] = BASE.bounds;
const mercY = lat => Math.log(Math.tan(Math.PI/4 + lat*Math.PI/360));
const MAP_W = 1000, PX_PER_RAD = MAP_W / ((B_E - B_W)*Math.PI/180);
const MAP_H = Math.round((mercY(B_N) - mercY(B_S))*PX_PER_RAD);
const project = (lat, lng) => [(lng - B_W)*Math.PI/180*PX_PER_RAD, (mercY(B_N) - mercY(lat))*PX_PER_RAD];
const KM_PER_UNIT = 6371*Math.cos((B_S + B_N)/2*Math.PI/180)/PX_PER_RAD;   // at the map's middle latitude
const units = km => km/KM_PER_UNIT;
const ringPath = ring => 'M' + ring.map(([lng, lat]) => project(lat, lng).map(v => v.toFixed(1)).join(' ')).join('L');

// ═══ 3. LOOKUPS (defaults, which a trip can replace) ══════════════════════════
const MODES = T.modes || {
  flight:{icon:'✈', label:'Flight', color:'#be3a2a'},
  train:{icon:'🚆', label:'Train', color:'#3a6e9a'},
  car:{icon:'🚗', label:'Car', color:'#896819'},
  bus:{icon:'🚌', label:'Bus', color:'#4a2888'},
  ferry:{icon:'⛴', label:'Ferry', color:'#1a6055'},
};
const DEFAULT_MODE = MODES[T.defaultMode] ? T.defaultMode : Object.keys(MODES)[0];
const CURVED_MODES = new Set(T.curvedModes || ['flight']);     // drawn as arcs rather than straight lines
const DOTTED_MODES = new Set(T.dottedModes || ['ferry']);
const TAG = {eat:'#fee2e2/#991b1b', bar:'#fed7aa/#9a3412', shop:'#e9d5ff/#6b21a8', culture:'#fae8ff/#86198f', nature:'#d1fae5/#065f46',
  park:'#dcfce7/#166534', view:'#cffafe/#155e75', sport:'#dbeafe/#1e40af', nightlife:'#ffe4e6/#be123c', beach:'#cffafe/#0e7490', ...(T.tagColors || {})};
const tagStyle = t => { const [bg, fg] = (TAG[t] || '#e5e7eb/#374151').split('/'); return `background:${bg};color:${fg}`; };
// Place categories, in the order they're listed in a stop. To guess a category, the
// words are checked in priority order (p); the name is tried first, then the note.
const DEFAULT_CATS = [
  {id:'stay', p:1, label:'Places to stay', icon:'🏨', words:['hotel','hostel','inn','resort','lodge','motel','guest house','airbnb','cabin','campground','camping','apartment']},
  {id:'see', p:6, label:'Sights', icon:'🏛', words:['museum','gallery','tower','memorial','palace','monument','castle','cathedral','church','temple','view','viewpoint','lookout','overlook','old town']},
  {id:'eat', p:4, label:'Restaurants', icon:'🍽', words:['restaurant','diner','grill','kitchen','bistro','steak','pizza','burger','bbq','tacos','sushi','ramen','food','eat','dinner','lunch','breakfast','brunch','market']},
  {id:'drink', p:2, label:'Bars', icon:'🍸', words:['bar','pub','saloon','brewery','brewing','taproom','distillery','winery','cocktail','beer','lounge','club']},
  {id:'cafe', p:3, label:'Cafés', icon:'☕', words:['cafe','café','coffee','espresso','bakery','donut','ice cream','dessert']},
  {id:'do', p:5, label:'Activities', icon:'🎯', words:['tour','class','workshop','rental','rentals','spa','hot springs','pool','golf','ski','surf','kayak','rafting','climbing','rodeo','stadium','show','concert','theater','theatre']},
  {id:'shop', p:7, label:'Shopping', icon:'🛍', words:['shop','shopping','store','outfitters','outlet','boutique','mall','vintage','books','bookstore','gallery shop','souvenir','market square']},
  {id:'nature', p:8, label:'Nature', icon:'🌿', words:['park','garden','beach','falls','waterfall','mountain','forest','lake','river','trail','hike','canyon','valley']},
  {id:'other', label:'Other', icon:'📍'},
];
const wordsRe = w => new RegExp(`(^|[^\\p{L}])(${w.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')).join('|')})s?(?=$|[^\\p{L}])`, 'iu');
const CATS = (T.categories || DEFAULT_CATS).map(c => ({...c, re: c.words?.length ? wordsRe(c.words) : null}));
if (!CATS.some(c => c.id === 'other')) CATS.push({id:'other', label:'Other', icon:'📍', re:null});
const catOf = id => CATS.find(c => c.id === id) || CATS.at(-1);
const MATCH_ORDER = CATS.filter(c => c.re).sort((a, b) => (a.p ?? 99) - (b.p ?? 99));   // e.g. 'Hotel bar' is a hotel; 'coffee bar' is a café
const matchCat = text => (MATCH_ORDER.find(c => c.re.test(String(text || ''))) || {}).id;
const classify = (name, note) => matchCat(name) || matchCat(note) || 'other';

const PALETTE = T.palette || ['#be3a2a','#3a6e9a','#1a5a38','#4a2888','#896819','#1b4878','#1a6055','#0e7490','#9f1239'];
const DIST = T.units === 'mi' ? {per: 1.609344, label: 'mi'} : {per: 1, label: 'km'};
const dist = k => `${Math.round(k/DIST.per)} ${DIST.label}`;
const NEAR_KM = T.nearKm ?? 150, FAR_KM = T.farKm ?? 250;   // "far from your nearest stop" / "filed too far away"
const LEG = {carrier: 'Airline or operator', carrierHint: '', number: 'Flight or booking number', numberHint: '', ...(T.legFields || {})};

// ═══ 4. DEFAULT PLAN — comes from trip.js; "Reset" goes back to it ════════════
const leg = (mode, est = '', notes = '') => ({mode, est, notes, carrier:'', number:'', confirmation:'', depDate:'', depTime:'', arrDate:'', arrTime:''});
const mkStop = (id, name, region, lat, lng, color, nights, regionIds, legIn, sections, tip = '') =>
  ({id, name, region, lat, lng, color, nights, regionIds, ...(legIn ? {leg: legIn} : {}), sections, tip, notes:'', places:[]});
const DEFAULT_TRIP = {version: 3, startDate: T.plan.startDate || '', stops: T.plan.stops.map((s, i) => ({
  notes:'', places:[], tip:'', sections:[], regionIds:[], color: PALETTE[i % PALETTE.length], nights: 1, ...s,
  ...(i && s.leg ? {leg: {...leg(DEFAULT_MODE), ...s.leg}} : {}),
  sections: (s.sections || []).map(sec => ({label: sec.label, items: sec.items.map(x => typeof x === 'string' ? {text: x, tags: [], hl: false} : {tags: [], hl: false, ...x})}))}))};

// Places added once to the shared plan, then never again (so anything you delete stays deleted).
// Each place: {name, note, cat, lat, lng, url, stop}; side: true marks trips away from the stop;
// approx: true means the position is rough.
const SEEDS = T.seeds || {id: 'none', places: []};

// Ideas from saved social posts (optional). Each idea: where, what (tags), and items that can be added.
const IDEAS = T.ideas || [];
const WHERE_STOP = T.ideaStops || {};
const ANYWHERE = `Anywhere${T.placeName ? ` in ${T.placeName}` : ''}`;

// ═══ 5. SMALL HELPERS ═════════════════════════════════════════════════════════
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '#';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const uid = () => Math.random().toString(36).slice(2, 10);
const readJSON = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const km = (a, b, c, d) => { const r = Math.PI/180, x = Math.sin((c-a)*r/2)**2 + Math.cos(a*r)*Math.cos(c*r)*Math.sin((d-b)*r/2)**2; return 12742*Math.asin(Math.sqrt(x)); };
const PAD = Math.max(B_N - B_S, B_E - B_W)*0.35;
const inArea = (lat, lng) => lat > B_S - PAD && lat < B_N + PAD && lng > B_W - PAD && lng < B_E + PAD;
const fmt = d => d.toLocaleDateString(undefined, {day:'numeric', month:'short'});
const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const openDlg = sel => { const d = $(sel); d.returnValue = ''; d.showModal(); };
const isBooked = L => Boolean(L && (L.carrier || L.number || L.confirmation || L.depTime));
function toast(msg, undo) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button">Undo</button>' : ''}`;
  t.classList.toggle('undo', Boolean(undo)); t.classList.add('on');
  if (undo) t.querySelector('button').onclick = () => { t.classList.remove('on'); undo(); };
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on', 'undo'), undo ? 7000 : 3600);
}
// Makes a change that can be undone from the toast for a few seconds.
function undoable(msg, change) {
  const before = JSON.stringify(trip);
  change(); save(); renderAll();
  toast(msg, () => { trip = normalize(JSON.parse(before)); save(); renderAll(); toast('Restored.'); });
}
function setPath(path, value) { const k = path.split('.'); let o = trip; k.slice(0, -1).forEach(p => o = o[p]); o[k.at(-1)] = value; }
const regionName = id => $$('#land path').find(p => p.dataset.rid === id)?.getAttribute('name') || id;
// The region under a map point. The topmost shape wins, so a park beats the state it sits in.
function regionAt(x, y, tol = 0) {
  const pt = $('#map').createSVGPoint(), paths = $$('#land path').reverse();
  const offsets = [[0,0], ...(tol ? Array.from({length:8}, (_, i) => [tol*Math.cos(i*Math.PI/4), tol*Math.sin(i*Math.PI/4)]) : [])];
  for (const [dx, dy] of offsets) { pt.x = x + dx; pt.y = y + dy; const hit = paths.find(p => p.isPointInFill(pt)); if (hit) return hit; }
  return null;
}

// ═══ 6. STATE AND SAVING ══════════════════════════════════════════════════════
// Keys are per trip, so several trips (and other planners on the same site) never share saved data.
const LS_KEY = `tripPlanner:${T.id}:plan`, LS_SYNC = `${LS_KEY}:sync:${TRIP_KEY}`;
const UI_KEY = `tripPlanner:${T.id}:view`;
const view = {openPlaces: {}, page: 'plan', ideaWhere: '', ideaWhat: '', ...(readJSON(UI_KEY) || {})};   // your own view settings; never shared
const saveView = () => { try { localStorage.setItem(UI_KEY, JSON.stringify(view)); } catch {} };
const ui = {openStop:null, openLeg:null, edit:false, day:1, showDay:false, playing:null, view:[0,0,MAP_W,MAP_H], pending:null};

// Brings any saved plan (including the older V1 format) into the current shape. Safe to run repeatedly.
function normalize(t) {
  if (!t || !Array.isArray(t.stops) || !t.stops.length) return null;
  t.stops.forEach((s, i) => {
    if (s.prefIds && !s.regionIds) s.regionIds = s.prefIds;   // plans copied from the Japan planner
    delete s.prefIds;
    s.id ||= uid(); s.sections ||= []; s.places ||= [];
    s.places.forEach(p => { p.id ||= uid(); p.note ??= ''; if (!CATS.some(c => c.id === p.cat)) p.cat = classify(p.name, p.note); });
    s.sections = s.sections.filter(sec => (sec.items || []).length); s.notes ??= ''; s.tip ??= ''; s.regionIds ||= [];
    s.color ||= PALETTE[i % PALETTE.length];
    s.nights = clamp(parseInt(s.nights) || 1, 1, 30);
    if (i === 0) delete s.leg; else { s.leg = {...leg(DEFAULT_MODE), ...(s.leg || {})}; if (!MODES[s.leg.mode]) s.leg.mode = DEFAULT_MODE; }
  });
  t.version = 3; t.startDate ||= ''; t.imports ||= []; t.hiddenIdeas ||= [];
  return t;
}
let trip = normalize(readJSON(LS_KEY)) || normalize(structuredClone(DEFAULT_TRIP));
const sync = {base:null, dirty:false, timer:null, busy:false, again:false, ...(readJSON(LS_SYNC) || {})};

const STATUS = {local:'Saved in this browser', saving:'Saving…', offline:'Offline — saved here, will sync', error:'Could not save — browser storage is blocked'};
function setStatus(kind, text) {
  const el = $('#status'); el.dataset.kind = kind;
  el.textContent = text || (kind === 'synced' ? `Shared, synced ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : STATUS[kind]);
}
function writeLocal() { try { localStorage.setItem(LS_KEY, JSON.stringify(trip)); return true; } catch { setStatus('error'); return false; } }
function writeSync() { try { localStorage.setItem(LS_SYNC, JSON.stringify({base: sync.base, dirty: sync.dirty})); } catch {} }

// Every change goes through save(): stored locally at once, and pushed to the shared copy shortly after.
function save() {
  normalize(trip);
  trip.updatedAt = new Date().toISOString();
  if (!writeLocal()) return;
  if (!REMOTE) return setStatus('local');
  sync.dirty = true; writeSync(); setStatus('saving');
  clearTimeout(sync.timer); sync.timer = setTimeout(push, 700);
}

function rpc(fn, body) {
  const headers = {'Content-Type':'application/json', apikey: CONFIG.supabaseKey};
  if (CONFIG.supabaseKey.startsWith('eyJ')) headers.Authorization = 'Bearer ' + CONFIG.supabaseKey; // legacy JWT-style anon keys
  return fetch(`${CONFIG.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {method:'POST', headers, body: JSON.stringify(body)})
    .then(async r => { if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); });
}
function adopt(row) {
  trip = normalize(row.trip) || trip;
  sync.base = row.saved_at; sync.dirty = false;
  writeLocal(); writeSync(); renderAll(); setStatus('synced');
}
async function push() {
  sync.timer = null;
  if (sync.busy) { sync.again = true; return; }
  sync.busy = true;
  try {
    const [r] = await rpc('save_trip', {p_key: TRIP_KEY, p_data: trip, p_base: sync.base});
    if (r.ok) { sync.base = r.saved_at; sync.dirty = false; writeSync(); setStatus('synced'); }
    else { sync.again = false; adopt(r); toast('Someone else saved at the same moment. Their version is loaded — please redo your last change.'); }
  } catch (e) { console.warn(e); setStatus('offline'); }
  sync.busy = false;
  if (sync.again) { sync.again = false; push(); }
}
const isTyping = () => document.activeElement?.matches('input,textarea,select') || $('dialog[open]');
async function poll() {
  if (!REMOTE || sync.busy || sync.timer || isTyping()) return;
  if (sync.dirty) return push();
  try {
    const [row] = await rpc('get_trip', {p_key: TRIP_KEY});
    if (row && row.saved_at !== sync.base) { adopt(row); toast('Loaded the latest changes from your group.'); }
    else setStatus('synced');
  } catch { setStatus('offline'); }
}
async function initRemote() {
  setStatus('saving', 'Connecting…');
  try {
    const [row] = await rpc('get_trip', {p_key: TRIP_KEY});
    if (!row) { sync.base = null; await push(); }                           // first person: upload this plan
    else if (sync.dirty && sync.base === row.saved_at) await push();         // our offline edits are the newest
    else { if (sync.dirty) toast('Newer shared changes replaced edits made while offline.'); adopt(row); }
  } catch (e) { console.warn(e); setStatus('offline'); }
  mergeSeeds();
  setInterval(poll, 15000);
  addEventListener('focus', poll);
}

// ═══ 7. DATES ═════════════════════════════════════════════════════════════════
const nightsBefore = i => trip.stops.slice(0, i).reduce((a, s) => a + s.nights, 0);
const totalNights = () => nightsBefore(trip.stops.length);
function dateAt(n) { if (!trip.startDate) return null; const d = new Date(trip.startDate + 'T00:00:00'); d.setDate(d.getDate() + n); return d; }
function dayInfo(d) {
  let c = 0;
  for (let i = 0; i < trip.stops.length; i++) {
    const n = trip.stops[i].nights;
    if (d <= c + n) return {i, s: trip.stops[i], night: d - c, travel: i > 0 && d === c + 1};
    c += n;
  }
  return null;
}

// ═══ 8. GOOGLE MAPS LINKS ═════════════════════════════════════════════════════
const MAPS_RE = /(google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps)/i;
// Reads a place name and coordinates out of pasted text. Works on full links; short
// maps.app.goo.gl links hide the location until expanded (browser can't; see resolverUrl).
function parseMapsText(text) {
  const url = (String(text).match(/https?:\/\/[^\s<>"]+/) || [''])[0];
  const out = {url, name: String(text).replace(url, '').trim().split('\n')[0].trim(), lat: null, lng: null, short: false};
  if (!url) return out;
  if (/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(url)) { out.short = true; return out; }
  let d; try { d = decodeURIComponent(url.replace(/\+/g, ' ')); } catch { d = url; }
  const n = '(-?\\d{1,3}\\.\\d+)';
  const m = d.match(new RegExp(`!3d${n}!4d${n}`))                                // exact pin
        || d.match(new RegExp(`[?&](?:q|query|ll|center|destination)=${n},\\s*${n}`)) // coordinates in the query
        || d.match(new RegExp(`@${n},${n}`));                                     // map view centre
  if (m) { out.lat = +m[1]; out.lng = +m[2]; }
  const place = d.match(/\/maps\/place\/([^/@?]+)/) || d.match(/[?&](?:q|query)=([^&]+)/);
  if (place && !/^\s*-?\d+\.\d+\s*,/.test(place[1])) out.name = place[1].trim() || out.name;
  return out;
}
async function expandShort(p) {
  if (!p.short || !CONFIG.resolverUrl) return p;
  try {
    const full = await (await fetch(`${CONFIG.resolverUrl}?url=${encodeURIComponent(p.url)}`)).text();
    const q = parseMapsText(full);
    return {...q, url: p.url, name: q.name || p.name, short: false};
  } catch { return p; }
}
const rankStops = (lat, lng) => trip.stops.map(s => ({s, km: km(lat, lng, s.lat, s.lng)})).sort((a, b) => a.km - b.km || b.s.nights - a.s.nights);

async function openPlaceDialog(text) {
  let p = parseMapsText(text);
  if (!p.url) return toast('That isn’t a link. In Google Maps, tap Share, copy the link and paste it here.');
  fillPlaceDialog(await expandShort(p));
}
// Opens the add-place dialog for p ({name, url, lat, lng, short?, approx?, side?}); opts can preset stop, cat, note.
function fillPlaceDialog(p, opts = {}) {
  const has = p.lat != null && inArea(p.lat, p.lng), ranked = has ? rankStops(p.lat, p.lng) : [];
  ui.pending = {...p, has};
  $('#pl-stop').innerHTML = trip.stops.map((s, i) =>
      `<option value="${s.id}">${i + 1}. ${esc(s.name)}${has ? ` — ${dist(km(p.lat, p.lng, s.lat, s.lng))}` : ''}</option>`).join('')
    + (has && !opts.stop ? '<option value="__new">New stop at this place</option>' : '');
  $('#pl-stop').value = byId(opts.stop) ? opts.stop : has ? ranked[0].s.id : (ui.openStop || trip.stops[0].id);
  $('#pl-name').value = p.name;
  $('#pl-note').value = opts.note || '';
  $('#pl-cat').innerHTML = CATS.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
  $('#pl-cat').value = opts.cat || classify(p.name, ''); $('#pl-cat').dataset.touched = opts.cat ? '1' : '';
  $('#place-info').textContent = opts.info ||
    ( has && ranked[0].km > NEAR_KM ? `Location found, ${dist(ranked[0].km)} from your nearest stop. Pick a stop, or make it a new one.`
    : has ? `Location found. Filed under your nearest stop, ${ranked[0].s.name} — change it if needed.`
    : p.short ? 'Short share links hide the location. Open the link, copy the full address from the browser bar and paste that — or just pick a stop below.'
    : p.lat != null ? 'That location is outside this trip’s map. Pick a stop to file it under.'
    : 'No location in this link. Pick a stop to file it under.');
  openDlg('#place-dlg');
}
function addPlace() {
  const p = ui.pending; if (!p) return;
  const place = {id: uid(), name: $('#pl-name').value.trim() || 'Unnamed place', note: $('#pl-note').value.trim(), cat: $('#pl-cat').value,
    url: p.url, lat: p.has ? p.lat : null, lng: p.has ? p.lng : null, ...(p.approx ? {approx: true} : {}), ...(p.side ? {side: true} : {})};
  let target = $('#pl-stop').value;
  if (target === '__new') {
    const hit = regionAt(...project(place.lat, place.lng), units(15));
    const s = mkStop(uid(), place.name, hit ? hit.getAttribute('name') : '', place.lat, place.lng, PALETTE[trip.stops.length % PALETTE.length], 1, hit ? [hit.dataset.rid] : [], leg(DEFAULT_MODE), []);
    trip.stops.splice(Math.max(1, trip.stops.length - 1), 0, s);  // before the final stop
    target = s.id;
    toast(`New stop ${s.name} added before your last stop. Use Edit stops to move it.`);
  } else toast(`Added ${place.name} to ${trip.stops.find(s => s.id === target).name}.`);
  trip.stops.find(s => s.id === target).places.push(place);
  ui.pending = null; ui.openStop = target; view.openPlaces[target] = true; saveView();
  save(); renderAll(); zoomToStop(target);
}

// ═══ 9. SIDEBAR ═══════════════════════════════════════════════════════════════
function renderHeader() {
  const n = totalNights(), start = dateAt(0), end = dateAt(n);
  $('#trip-summary').innerHTML = start ? `${fmt(start)} – ${fmt(end)}<small>${n} nights</small>` : `${n} nights<small>add a start date for real dates</small>`;
  $('#end-date').textContent = end ? `ends ${fmt(end)}` : '';
  $('#start-date').value = trip.startDate;
  $('#edit-btn').setAttribute('aria-pressed', ui.edit);
  document.querySelectorAll('.shared-note').forEach(e => e.hidden = !REMOTE);
}
function legHTML(s, i) {
  const L = s.leg, m = MODES[L.mode] || MODES[DEFAULT_MODE], open = ui.openLeg === s.id, booked = isBooked(L), p = `stops.${i}.leg.`;
  const f = (key, label, type = 'text', ph = '') => `<label>${label}<input type="${type}" data-bind="${p}${key}" value="${esc(L[key])}" placeholder="${esc(ph)}"></label>`;
  const summary = booked ? [L.carrier, L.number, L.depTime && `departs ${L.depTime}`].filter(Boolean).join(', ') || 'Booking saved' : `${m.label}, about ${L.est || '?'}`;
  return `<div class="leg${open ? ' open' : ''}">
    <button class="leg-head" data-action="toggle-leg" data-id="${s.id}" aria-expanded="${open}">
      <span class="leg-icon">${m.icon}</span>
      <span class="leg-text"><b>${esc(trip.stops[i - 1].name)} to ${esc(s.name)}</b><span>${esc(summary)}</span></span>
      <span class="badge${booked ? ' on' : ''}">${booked ? 'Booked' : 'Not booked'}</span>
    </button>
    ${open ? `<div class="leg-form">
      <label>How<select data-bind="${p}mode" data-rerender>${Object.entries(MODES).map(([k, v]) => `<option value="${k}"${k === L.mode ? ' selected' : ''}>${v.icon} ${v.label}</option>`).join('')}</select></label>
      ${f('est', 'Rough duration', 'text', '2h')}
      ${f('carrier', LEG.carrier, 'text', LEG.carrierHint)}${f('number', LEG.number, 'text', LEG.numberHint)}
      ${f('depDate', 'Departs', 'date')}${f('depTime', 'Departure time', 'time')}
      ${f('arrDate', 'Arrives', 'date')}${f('arrTime', 'Arrival time', 'time')}
      ${f('confirmation', 'Booking reference')}
      <label class="full">Notes<input data-bind="${p}notes" value="${esc(L.notes)}" placeholder="${esc(LEG.notesHint || 'Transfers, seats, luggage…')}"></label>
      <button class="link" data-action="clear-leg" data-id="${s.id}">Clear booking details</button>
    </div>` : ''}
  </div>`;
}
function stopHTML(s, i) {
  const open = ui.openStop === s.id, start = dateAt(nightsBefore(i)), end = dateAt(nightsBefore(i) + s.nights), p = `stops.${i}.`;
  const title = ui.edit
    ? `<input class="name-in" data-bind="${p}name" data-rerender value="${esc(s.name)}" aria-label="Stop name"><input class="region-in" data-bind="${p}region" value="${esc(s.region)}" aria-label="Region">`
    : `<span class="s-name">${esc(s.name)}</span><span class="s-sub">${esc(s.region)}${start ? `<em>${fmt(start)} – ${fmt(end)}</em>` : ''}${s.places.length ? `<em>${s.places.length} saved</em>` : ''}</span>`;
  const editCtl = ui.edit ? `<span class="edit-ctl">
      <button data-action="move" data-id="${s.id}" data-d="-1" aria-label="Move up"${i === 0 ? ' disabled' : ''}>▲</button>
      <button data-action="move" data-id="${s.id}" data-d="1" aria-label="Move down"${i === trip.stops.length - 1 ? ' disabled' : ''}>▼</button>
      <button data-action="delete-stop" data-id="${s.id}" aria-label="Remove stop">✕</button></span>` : '';
  return `<section class="stop${open ? ' open' : ''}" data-sid="${s.id}" style="--c:${esc(s.color)}">
    <div class="stop-head" data-action="toggle-stop" data-id="${s.id}" role="button" tabindex="0" aria-expanded="${open}">
      <span class="num">${i + 1}</span>
      <span class="s-meta">${title}</span>
      ${editCtl}
      <span class="nights" title="Nights here">
        <button data-action="nights" data-id="${s.id}" data-d="-1" aria-label="One night fewer">−</button>
        <input type="number" min="1" max="30" data-bind="${p}nights" data-int data-rerender value="${s.nights}" aria-label="Nights in ${esc(s.name)}">
        <button data-action="nights" data-id="${s.id}" data-d="1" aria-label="One night more">+</button>
      </span>
    </div>
    ${open ? `<div class="stop-body">${bodyHTML(s, i)}</div>` : ''}
  </section>`;
}
function bodyHTML(s, i) {
  const p = `stops.${i}.`;
  const sections = s.sections.map((sec, k) => `<h4>${esc(sec.label)}</h4><ul class="things">${sec.items.map((x, m) =>
      `<li class="${x.hl ? 'hl' : ''}"><span>${esc(x.text)}</span>${(x.tags || []).map(t => `<i class="tag" style="${tagStyle(t)}">${esc(t)}</i>`).join('')}`
      + `<button class="x" data-action="delete-item" data-id="${s.id}" data-sec="${k}" data-item="${m}" aria-label="Remove ${esc(x.text)}">✕</button></li>`).join('')}</ul>`).join('');
  return sections + placesHTML(s, i) + (s.tip ? `<p class="tip">${esc(s.tip)}</p>` : '')
    + `<label class="notes">Notes<textarea data-bind="${p}notes" rows="2" placeholder="Hotel, reminders, ideas…">${esc(s.notes)}</textarea></label>`;
}
function placesHTML(s, i) {
  if (!s.places.length) return '';
  const open = Boolean(view.openPlaces[s.id]);
  const groups = CATS.map(c => [c, s.places.filter(pl => pl.cat === c.id).sort((a, b) => a.name.localeCompare(b.name))]).filter(([, list]) => list.length);
  const head = `<button class="pl-toggle" data-action="toggle-places" data-id="${s.id}" aria-expanded="${open}">
      <b>Saved places (${s.places.length})</b><span class="pl-counts">${groups.map(([c, l]) => `${c.icon} ${l.length}`).join('  ')}</span><span class="chev">▼</span></button>`;
  if (!open) return head;
  return head + groups.map(([c, list]) => `<h5>${c.icon} ${c.label}</h5><ul class="places">${list.map(pl => {
    const j = s.places.indexOf(pl);
    return `<li>
      <div class="pl-top">
        <a href="${esc(safeUrl(pl.url))}" target="_blank" rel="noopener">${esc(pl.name)}</a>
        ${pl.side && pl.lat != null ? `<em class="side" title="Away from ${esc(s.name)}">Side trip, ${dist(km(pl.lat, pl.lng, s.lat, s.lng))}</em>` : ''}
        <button class="x" data-action="delete-place" data-id="${s.id}" data-pid="${pl.id}" aria-label="Remove ${esc(pl.name)}">✕</button>
      </div>
      <div class="pl-meta">
        <select data-bind="stops.${i}.places.${j}.cat" data-rerender aria-label="Category for ${esc(pl.name)}">${CATS.map(o => `<option value="${o.id}"${o.id === pl.cat ? ' selected' : ''}>${o.icon} ${o.label}</option>`).join('')}</select>
        <select data-action="move-place" data-id="${s.id}" data-pid="${pl.id}" aria-label="Move ${esc(pl.name)} to another stop">${trip.stops.map((o, k) =>
          `<option value="${o.id}"${o.id === s.id ? ' selected' : ''}>${k + 1}. ${esc(o.name)}</option>`).join('')}</select>
      </div>
      <input class="pl-note" data-bind="stops.${i}.places.${j}.note" value="${esc(pl.note)}" placeholder="Add a note" aria-label="Note for ${esc(pl.name)}">
    </li>`; }).join('')}</ul>`).join('');
}
function renderStops() { $('#stops').innerHTML = trip.stops.map((s, i) => (i ? legHTML(s, i) : '') + stopHTML(s, i)).join(''); }

// ═══ 9b. INSTAGRAM IDEAS PAGE ═════════════════════════════════════════════════
const normName = t => String(t || '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '');
const ideaItems = d => d.items.length ? d.items : [{name: d.title, cat: d.cat || 'other', note: d.summary}];
function inPlan(d, it) {
  const n = normName(it.name), m = (it.match || []).map(normName);
  return trip.stops.some(s => s.places.some(p => {
    const pn = normName(p.name);
    return pn === n || (p.url === d.url && normName(p.name) === n) || m.some(x => x && pn.includes(x));
  }));
}
function renderIdeas() {
  const hidden = new Set(trip.hiddenIdeas);
  if (view.ideaWhat === '__hidden' && !hidden.size) view.ideaWhat = '';   // nothing left to show under Hidden
  const showHidden = view.ideaWhat === '__hidden';
  $('#ideas-count').textContent = ` ${IDEAS.filter(d => !hidden.has(d.id)).length}`;
  if (view.page !== 'ideas') return;
  const wheres = [...new Set(IDEAS.map(d => d.where))], whats = [...new Set(IDEAS.flatMap(d => d.what))].sort();
  const chip = (group, v, label, on) => `<button class="chip" data-action="idea-filter" data-g="${group}" data-v="${esc(v)}" aria-pressed="${on}">${esc(label)}</button>`;
  $('#idea-where').innerHTML = '<span class="chip-lbl">Where</span>' + chip('where', '', 'All', !view.ideaWhere) + wheres.map(w => chip('where', w, w === 'Anywhere' ? ANYWHERE : w, view.ideaWhere === w)).join('');
  $('#idea-what').innerHTML = '<span class="chip-lbl">What</span>' + chip('what', '', 'All', !view.ideaWhat) + whats.map(w => chip('what', w, w, view.ideaWhat === w)).join('')
    + (hidden.size ? chip('what', '__hidden', `Hidden (${hidden.size})`, showHidden) : '');
  const q = normName($('#idea-q').value);
  const list = IDEAS.filter(d => (showHidden ? hidden.has(d.id) : !hidden.has(d.id))
    && (!view.ideaWhere || d.where === view.ideaWhere)
    && (!view.ideaWhat || showHidden || d.what.includes(view.ideaWhat))
    && (!q || normName([d.title, d.summary, d.user, d.where, ...d.what, ...d.items.map(i => i.name)].join(' ')).includes(q)));
  const added = list.reduce((n, d) => n + ideaItems(d).filter(it => inPlan(d, it)).length, 0);
  $('#ideas-sum').textContent = list.length
    ? `${list.length} idea${list.length > 1 ? 's' : ''} from saved posts${added ? `, ${added} already in the plan` : ''}. Press + to add one to a stop.`
    : showHidden ? 'No hidden ideas.' : 'No ideas match. Try another filter.';
  $('#idea-grid').innerHTML = list.map(d => `<article class="idea${hidden.has(d.id) ? ' is-hidden' : ''}">
      <div class="idea-tags"><span class="where">📍 ${esc(d.where === 'Anywhere' ? ANYWHERE : d.where)}</span>${d.what.map(w => `<span>${esc(w)}</span>`).join('')}</div>
      <h3>${esc(d.title)}</h3>
      <p>${esc(d.summary)}</p>
      <ul class="idea-items">${ideaItems(d).map((it, j) => `<li>
        <span>${catOf(it.cat).icon} ${esc(it.name)}${it.side ? ' <em class="side">Side trip</em>' : ''}</span>
        ${inPlan(d, it) ? '<span class="inplan">In plan ✓</span>'
          : `<button class="plus" data-action="idea-add" data-id="${d.id}" data-j="${j}" aria-label="Add ${esc(it.name)} to the plan">+</button>`}</li>`).join('')}</ul>
      <footer><a href="${esc(safeUrl(d.url))}" target="_blank" rel="noopener">@${esc(d.user)}${/instagram\.com/.test(d.url) ? ' on Instagram' : ''}</a>${d.also ? `<a href="${esc(safeUrl(d.also))}" target="_blank" rel="noopener">repost</a>` : ''}<span>${esc(d.date)}</span>
        <button class="hide" data-action="idea-hide" data-id="${d.id}">${hidden.has(d.id) ? 'Unhide' : 'Hide'}</button></footer>
    </article>`).join('');
}
function setPage(page) {
  if (!IDEAS.length) page = 'plan';
  view.page = page; saveView();
  document.body.dataset.page = page;
  $$('.tabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === page));
  if (page === 'plan') renderMap(); else renderIdeas();
}

// ═══ 10. MAP ══════════════════════════════════════════════════════════════════
// Draws the basemap once: regions (the shapes stops are checked against), then water, rivers, roads and labels.
function renderBasemap() {
  const svg = $('#map');
  svg.setAttribute('viewBox', `0 0 ${MAP_W} ${MAP_H}`);
  svg.setAttribute('aria-label', `Map of ${T.placeName || T.title} with the trip route`);
  $('#land').innerHTML = BASE.regions.map(r => `<path data-rid="${esc(r.id)}" name="${esc(r.name)}" class="${esc(r.class || 'land')}" d="${r.rings.map(ringPath).join('Z')}Z"/>`).join('');
  $('#water').innerHTML = BASE.water.map(rings => `<path d="${rings.map(ringPath).join('Z')}Z"/>`).join('');
  const line = pts => `<path d="${ringPath(pts)}"/>`;
  $('#rivers').innerHTML = BASE.rivers.map(line).join('');
  $('#roads').innerHTML = BASE.roads.map(line).join('');
}
// Place-name labels stay the same size on screen as you zoom (k = map units per screen pixel).
function renderLabels(k) {
  const size = {park: 13, water: 10.5, region: 12};
  $('#labels').innerHTML = (BASE.labels || []).map(l => { const [x, y] = project(l.lat, l.lng);
    return `<text x="${x}" y="${y}" font-size="${(size[l.kind] || 11)*k}" stroke-width="${3*k}" class="lbl-${esc(l.kind || 'other')}" text-anchor="middle">${esc(l.text)}</text>`; }).join('');
}
function renderLand() {
  const byRegion = {}; trip.stops.forEach(s => s.regionIds.forEach(id => byRegion[id] ||= s));   // shared regions take the first stop's colour
  const tints = p => !T.tintClasses || T.tintClasses.some(c => p.classList.contains(c));       // e.g. tint parks but not whole states
  $$('#land path').forEach(p => {
    const s = tints(p) ? (ui.openStop && byId(ui.openStop)?.regionIds.includes(p.dataset.rid) ? byId(ui.openStop) : byRegion[p.dataset.rid]) : null, pct = !s ? 0 : ui.openStop ? (ui.openStop === s.id ? (T.tintOpen ?? 55) : 18) : (T.tintRest ?? 32);
    p.style.fill = s ? `color-mix(in srgb, ${s.color} ${pct}%, ${p.classList.contains('park') ? 'var(--park)' : 'var(--land)'})` : '';
  });
  const used = [...new Set(trip.stops.slice(1).map(s => s.leg.mode))];
  $('#legend').innerHTML = used.filter(k => MODES[k]).map(k => `<span><i style="background:${MODES[k].color}"></i>${MODES[k].icon} ${MODES[k].label}</span>`).join('')
    + '<span><i class="dot"></i>Saved place (ring: approximate)</span><span style="color:var(--muted)">Dashed lines: not booked yet</span>';
}
// Where each pin is drawn: its true spot, nudged outward if it would cover an earlier pin.
function pinPositions(k) {
  const placed = [];
  return trip.stops.map(s => {
    const [tx, ty] = project(s.lat, s.lng); let x = tx, y = ty;
    for (let t = 0; t < 30 && placed.some(([px, py]) => Math.hypot(px - x, py - y) < 20*k); t++) {
      const a = t*2.4, r = 20*k*(1 + t/6); x = tx + Math.cos(a)*r; y = ty + Math.sin(a)*r;
    }
    placed.push([x, y]);
    return {x, y, tx, ty};
  });
}
function renderOverlay() {
  const svg = $('#map'); svg.setAttribute('viewBox', ui.view.join(' '));
  const k = Math.max(ui.view[2]/(svg.clientWidth || MAP_W), ui.view[3]/(svg.clientHeight || MAP_H)), pos = pinPositions(k);  // map units per screen pixel
  renderLabels(k);
  let routes = '';
  for (let i = 1; i < trip.stops.length; i++) {
    const L = trip.stops[i].leg, m = MODES[L.mode] || MODES[DEFAULT_MODE], a = pos[i - 1], b = pos[i], booked = isBooked(L);
    const bend = CURVED_MODES.has(L.mode) ? 0.2 : 0, cx = (a.x + b.x)/2 - (b.y - a.y)*bend, cy = (a.y + b.y)/2 + (b.x - a.x)*bend;
    const mx = (a.x + 2*cx + b.x)/4, my = (a.y + 2*cy + b.y)/4, deg = Math.atan2(b.y - a.y, b.x - a.x)*180/Math.PI;
    const dash = booked ? 'none' : DOTTED_MODES.has(L.mode) ? `${3*k} ${4*k}` : `${7*k} ${5*k}`;
    routes += `<path d="M${a.x} ${a.y}Q${cx} ${cy} ${b.x} ${b.y}" fill="none" stroke="${m.color}" stroke-width="${(booked ? 2.8 : 2)*k}" stroke-dasharray="${dash}" opacity="${booked ? .9 : .65}"/>
      <path d="M${-6*k} ${-4.5*k}L${6*k} 0L${-6*k} ${4.5*k}z" fill="${m.color}" transform="translate(${mx} ${my}) rotate(${deg})"/>`;
    if (Math.hypot(b.x - a.x, b.y - a.y) > 70*k)
      routes += `<text x="${mx}" y="${my - 9*k}" font-size="${10*k}" font-weight="600" text-anchor="middle" fill="${m.color}" stroke="#fff" stroke-width="${3*k}" paint-order="stroke">${esc(m.icon + ' ' + (L.number || L.est))}</text>`;
  }
  $('#routes').innerHTML = routes;

  // Place dots, then as many labels as fit without overlapping (more appear as you zoom in).
  const taken = [];
  const fits = (x, y, w, h) => { if (taken.some(b => x < b[2] && x + w > b[0] && y < b[3] && y + h > b[1])) return false; taken.push([x, y, x + w, y + h]); return true; };
  pos.forEach(p => fits(p.x - 11*k, p.y - 11*k, 22*k, 22*k));   // keep labels off the stop pins
  $('#places').innerHTML = trip.stops.flatMap(s => s.places.filter(p => p.lat != null).map(p => {
    const [x, y] = project(p.lat, p.lng), label = `${catOf(p.cat).icon} ${p.name}`;
    const showLabel = k*KM_PER_UNIT < 0.36 && fits(x + 7*k, y - 7*k, (label.length*6 + 6)*k, 14*k);
    return `<g data-sid="${s.id}" data-tip="${esc(label)} (${esc(s.name)})${p.approx ? ', approximate location' : ''}">`
      + (p.approx ? `<circle cx="${x}" cy="${y}" r="${4.5*k}" fill="#fff" fill-opacity=".85" stroke="${esc(s.color)}" stroke-width="${2*k}"/>`
                  : `<circle cx="${x}" cy="${y}" r="${5*k}" fill="${esc(s.color)}" stroke="#fff" stroke-width="${1.5*k}"/>`)
      + (showLabel ? `<text x="${x + 8*k}" y="${y}" font-size="${11*k}" font-weight="500" dominant-baseline="central" fill="#1c1917" stroke="#fff" stroke-width="${3*k}" paint-order="stroke">${esc(label)}</text>` : '') + '</g>';
  })).join('');

  const info = ui.showDay ? dayInfo(ui.day) : null;
  $('#pins').innerHTML = trip.stops.map((s, i) => {
    const p = pos[i], active = ui.openStop === s.id, r = (active ? 11 : 9)*k, moved = Math.hypot(p.x - p.tx, p.y - p.ty) > 1;
    return `<g data-sid="${s.id}" data-tip="${i + 1}. ${esc(s.name)}, ${s.nights} night${s.nights > 1 ? 's' : ''}">
      ${moved ? `<line x1="${p.tx}" y1="${p.ty}" x2="${p.x}" y2="${p.y}" stroke="${esc(s.color)}" stroke-width="${1.2*k}"/><circle cx="${p.tx}" cy="${p.ty}" r="${2.2*k}" fill="${esc(s.color)}"/>` : ''}
      <circle cx="${p.x + k}" cy="${p.y + 2*k}" r="${r}" fill="rgba(0,0,0,.2)"/>
      <circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${esc(s.color)}" stroke="#fff" stroke-width="${(active ? 2.5 : 2)*k}"/>
      <text x="${p.x}" y="${p.y}" font-size="${(active ? 10.5 : 9.5)*k}" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central" style="font-family:var(--display)">${i + 1}</text>
    </g>`;
  }).join('') + (info ? dayMarker(info, pos, k) : '');
}
function dayMarker(info, pos, k) {
  const p = pos[info.i];
  let out = '';
  if (info.travel) {
    const a = pos[info.i - 1], m = MODES[info.s.leg.mode] || MODES[DEFAULT_MODE];
    out += `<g transform="translate(${(a.x + p.x)/2} ${(a.y + p.y)/2})"><circle r="${13*k}" fill="${m.color}" stroke="#fff" stroke-width="${2*k}"/><text font-size="${13*k}" text-anchor="middle" dominant-baseline="central">${m.icon}</text></g>`;
  }
  return out + `<g transform="translate(${p.x} ${p.y - 24*k})"><g class="bob"><circle r="${9.5*k}" fill="#f2b705" stroke="#1c1917" stroke-width="${1.6*k}"/><text font-size="${10*k}" font-weight="700" text-anchor="middle" dominant-baseline="central">${info.i + 1}</text></g></g>`;
}
function renderMap() { renderLand(); renderOverlay(); }

// Zoom and pan
function clampView(v) {
  const w = clamp(v[2], 18, MAP_W), h = w*MAP_H/MAP_W;
  return [clamp(v[0], -w/2, MAP_W - w/2), clamp(v[1], -h/2, MAP_H - h/2), w, h];
}
function setView(target) {
  target = clampView(target);
  const from = [...ui.view], t0 = performance.now();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { ui.view = target; return renderOverlay(); }
  const step = t => { const q = Math.min(1, (t - t0)/320), e = 1 - (1 - q)**3; ui.view = from.map((v, i) => v + (target[i] - v)*e); renderOverlay(); if (q < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function viewAround(points, minW = 170) {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const w = Math.max(minW, (Math.max(...xs) - Math.min(...xs))*1.3, (Math.max(...ys) - Math.min(...ys))*1.3*MAP_W/MAP_H), h = w*MAP_H/MAP_W;
  return [(Math.min(...xs) + Math.max(...xs))/2 - w/2, (Math.min(...ys) + Math.max(...ys))/2 - h/2, w, h];
}
const fitAll = () => setView(viewAround(trip.stops.map(s => project(s.lat, s.lng)), MAP_W*.5));
function zoomToStop(id) {
  const s = trip.stops.find(x => x.id === id); if (!s) return;
  setView(viewAround([project(s.lat, s.lng), ...s.places.filter(p => p.lat != null && !p.side).map(p => project(p.lat, p.lng))], Math.min(MAP_W*.6, units(T.stopZoomKm ?? 180))));
}
function zoomBy(f, [px, py] = [ui.view[0] + ui.view[2]/2, ui.view[1] + ui.view[3]/2]) {
  const [x, y, w, h] = ui.view, nw = clamp(w*f, 18, MAP_W); f = nw/w;
  ui.view = clampView([px - (px - x)*f, py - (py - y)*f, w*f, h*f]); renderOverlay();
}
function svgPoint(e) { const svg = $('#map'), pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const r = pt.matrixTransform(svg.getScreenCTM().inverse()); return [r.x, r.y]; }

// ═══ 11. DAY-BY-DAY PLAYBACK ══════════════════════════════════════════════════
function renderPlayback() {
  const total = totalNights(), slider = $('#day');
  ui.day = clamp(ui.day, 1, total); slider.max = total; slider.value = ui.day;
  if (!ui.showDay) return;
  const info = dayInfo(ui.day), d = dateAt(ui.day - 1);
  $('#day-label').textContent = `Day ${ui.day} of ${total}${d ? `, ${fmt(d)}` : ''}: ${info.s.name}${info.travel ? ', travel day' : `, night ${info.night} of ${info.s.nights}`}`;
}
function goToDay(d) {
  ui.day = clamp(d, 1, totalNights()); ui.showDay = true;
  const info = dayInfo(ui.day); ui.openStop = info.s.id;
  renderStops(); renderMap(); renderPlayback();
  document.querySelector(`[data-sid="${info.s.id}"]`)?.scrollIntoView({block:'nearest', behavior:'smooth'});
}
function togglePlay() {
  const btn = $('#play');
  if (ui.playing) { clearInterval(ui.playing); ui.playing = null; btn.textContent = '▶'; btn.setAttribute('aria-pressed', 'false'); return; }
  if (ui.day >= totalNights()) ui.day = 0;
  btn.textContent = '❚❚'; btn.setAttribute('aria-pressed', 'true');
  goToDay(ui.day + 1);
  ui.playing = setInterval(() => ui.day >= totalNights() ? togglePlay() : goToDay(ui.day + 1), 1400);
}

// ═══ 12. ACTIONS AND EVENTS ═══════════════════════════════════════════════════
function renderAll() { renderHeader(); renderStops(); renderMap(); renderPlayback(); renderIdeas(); }
const byId = id => trip.stops.find(s => s.id === id);

const ACTIONS = {
  'toggle-stop': d => { ui.openStop = ui.openStop === d.id ? null : d.id; renderStops(); renderMap(); if (ui.openStop) zoomToStop(d.id); },
  'toggle-leg': d => { ui.openLeg = ui.openLeg === d.id ? null : d.id; renderStops(); },
  'nights': d => { const s = byId(d.id); s.nights = clamp(s.nights + +d.d, 1, 30); save(); renderAll(); },
  'move': d => { const a = trip.stops, i = a.findIndex(s => s.id === d.id), j = i + +d.d; [a[i], a[j]] = [a[j], a[i]]; save(); renderAll(); toast('Moved. Check the travel details either side of it.'); },
  'delete-stop': d => { const s = byId(d.id); if (trip.stops.length < 2) return; undoable(`Removed ${s.name}${s.places.length ? ` and its ${s.places.length} saved places` : ''}.`, () => { trip.stops = trip.stops.filter(x => x !== s); }); },
  'clear-leg': d => { const s = byId(d.id); undoable('Booking details cleared.', () => { s.leg = leg(s.leg.mode, s.leg.est); }); },
  'delete-place': d => { const s = byId(d.id), pl = s.places.find(p => p.id === d.pid); undoable(`Removed ${pl.name}.`, () => { s.places = s.places.filter(p => p !== pl); }); },
  'delete-item': d => { const s = byId(d.id), sec = s.sections[+d.sec], x = sec.items[+d.item]; undoable(`Removed ${x.text}.`, () => { sec.items = sec.items.filter(y => y !== x); }); },
  'toggle-places': d => { view.openPlaces[d.id] = !view.openPlaces[d.id]; saveView(); renderStops(); },
  'toggle-edit': () => { ui.edit = !ui.edit; renderHeader(); renderStops(); },
  'add-stop': () => { $('#paste-in').focus(); toast('Paste a Google Maps link for the new stop, then choose “New stop at this place”.'); },
  'step': d => goToDay((ui.showDay ? ui.day : 0) + +d.d),
  'play': () => togglePlay(),
  'zoom': d => zoomBy(+d.f),
  'fit': () => fitAll(),
  'copy': () => navigator.clipboard.writeText(JSON.stringify(trip, null, 1)).then(() => toast('Plan copied. Paste it into a chat with Claude to have the file updated.'), () => toast('Copy was blocked by the browser.')),
  'import': () => { $('#import-text').value = ''; openDlg('#import-dlg'); },
  'reset': () => { if (!confirm(`Go back to the built-in plan?${REMOTE ? ' This changes it for everyone sharing the plan.' : ''} Your edits will be lost.`)) return; trip = normalize(structuredClone(DEFAULT_TRIP)); ui.openStop = ui.openLeg = null; save(); renderAll(); fitAll(); },
  'checks': () => showChecks(),
  'page': d => setPage(d.v),
  'idea-filter': d => { view[d.g === 'where' ? 'ideaWhere' : 'ideaWhat'] = d.v; saveView(); renderIdeas(); },
  'idea-add': d => {
    const idea = IDEAS.find(x => x.id === d.id), it = ideaItems(idea)[+d.j];
    fillPlaceDialog({name: it.name, url: idea.url, lat: it.lat ?? null, lng: it.lng ?? null, approx: it.approx, side: it.side},
      {stop: WHERE_STOP[it.where || idea.where], cat: it.cat, note: `${it.note || idea.summary} (via @${idea.user})`,
       info: `From @${idea.user}. Filed under ${byId(WHERE_STOP[it.where || idea.where])?.name || 'your first stop'} — change the stop if needed.`});
  },
  'idea-hide': d => {
    const idea = IDEAS.find(x => x.id === d.id), was = trip.hiddenIdeas.includes(d.id);
    undoable(was ? `Showing ${idea.title} again.` : `Hid ${idea.title}.`, () => { trip.hiddenIdeas = was ? trip.hiddenIdeas.filter(x => x !== d.id) : [...trip.hiddenIdeas, d.id]; });
  },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'SELECT') return;
  if (e.target.closest('input,select,textarea') && el !== e.target) return;   // typing in a field inside a clickable header
  ACTIONS[el.dataset.action]?.(el.dataset, el);
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button]')) { e.preventDefault(); e.target.click(); }
});
// Any field with data-bind saves itself as you type.
document.addEventListener('input', e => {
  const t = e.target; if (!t.dataset.bind) return;
  let v = t.value;
  if ('int' in t.dataset) { v = parseInt(v); if (!(v >= 1)) return; v = Math.min(v, 30); }
  setPath(t.dataset.bind, v); save();
  if (t.dataset.bind === 'startDate') renderAll();
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.action === 'move-place') {
    const from = byId(t.dataset.id), to = byId(t.value), pl = from.places.find(p => p.id === t.dataset.pid);
    from.places = from.places.filter(p => p !== pl); to.places.push(pl); save(); renderAll();
    return toast(`Moved ${pl.name} to ${to.name}.`);
  }
  if ('rerender' in t.dataset) renderAll();
});
// Pasting: a Maps link pasted anywhere (outside a text field) opens the add-place dialog.
document.addEventListener('paste', e => {
  const text = e.clipboardData.getData('text'), t = e.target;
  if (t.id === 'paste-in' || (!t.closest?.('input,textarea') && MAPS_RE.test(text))) { e.preventDefault(); t.id === 'paste-in' && (t.value = ''); openPlaceDialog(text); }
});
// Enter waits for the key to finish: opening the dialog mid-keypress let the same Enter press its Cancel button.
$('#paste-in').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.value.trim()) return;
  e.preventDefault();
  const text = e.target.value; e.target.value = '';
  setTimeout(() => openPlaceDialog(text), 0);
});
['#pl-name', '#pl-note'].forEach(sel => $(sel).addEventListener('input', () => { if (!$('#pl-cat').dataset.touched) $('#pl-cat').value = classify($('#pl-name').value, $('#pl-note').value); }));
$('#pl-cat').addEventListener('change', e => e.target.dataset.touched = '1');
$('#place-dlg').addEventListener('close', e => { if (e.target.returnValue === 'add') addPlace(); });   // no clean-up here: a new paste may already be open
$('#import-dlg').addEventListener('close', e => {
  if (e.target.returnValue !== 'load') return;
  let t; try { t = normalize(JSON.parse($('#import-text').value)); } catch {}
  if (!t) return toast('That isn’t plan text. Use “Copy plan” to get it, then paste it here.');
  trip = t; ui.openStop = ui.openLeg = null; save(); renderAll(); fitAll(); toast('Plan loaded.');
});
$('#day').addEventListener('input', e => goToDay(+e.target.value));
$('#idea-q').addEventListener('input', renderIdeas);

// Map: hover, click, wheel zoom, drag to pan
const svgEl = $('#map'), tipEl = $('#tip');
let hoverSid = null, drag = null;
svgEl.addEventListener('mousemove', e => {
  const t = e.target.closest('[data-tip]'), sid = t?.dataset.sid || null;
  if (t) { const r = $('.map').getBoundingClientRect(); tipEl.textContent = t.dataset.tip; tipEl.style.left = (e.clientX - r.left) + 'px'; tipEl.style.top = (e.clientY - r.top) + 'px'; }
  tipEl.classList.toggle('on', Boolean(t));
  if (sid !== hoverSid) { hoverSid = sid; $$('.stop').forEach(el => el.classList.toggle('hover', el.dataset.sid === sid)); }
});
svgEl.addEventListener('mouseleave', () => { tipEl.classList.remove('on'); hoverSid = null; $$('.stop.hover').forEach(el => el.classList.remove('hover')); });
svgEl.addEventListener('click', e => {
  const sid = e.target.closest('[data-sid]')?.dataset.sid; if (!sid) return;
  ui.openStop = sid; renderStops(); renderMap(); zoomToStop(sid);
  document.querySelector(`.stop[data-sid="${sid}"]`)?.scrollIntoView({block:'nearest', behavior:'smooth'});
});
svgEl.addEventListener('wheel', e => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 0.85 : 1.18, svgPoint(e)); }, {passive:false});
svgEl.addEventListener('pointerdown', e => { if (e.target.closest('[data-sid]')) return; drag = {x: e.clientX, y: e.clientY, v: [...ui.view]}; svgEl.setPointerCapture(e.pointerId); svgEl.classList.add('dragging'); });
svgEl.addEventListener('pointermove', e => {
  if (!drag) return;
  const u = Math.max(drag.v[2]/svgEl.clientWidth, drag.v[3]/svgEl.clientHeight);   // map units per screen pixel
  ui.view = clampView([drag.v[0] - (e.clientX - drag.x)*u, drag.v[1] - (e.clientY - drag.y)*u, drag.v[2], drag.v[3]]);
  renderOverlay();
});
['pointerup','pointercancel'].forEach(t => svgEl.addEventListener(t, () => { drag = null; svgEl.classList.remove('dragging'); }));

// Adds the Google Maps list to the plan once. Runs after the shared plan has loaded.
function mergeSeeds() {
  if (!SEEDS.places.length || trip.imports.includes(SEEDS.id)) return;
  const have = new Set(trip.stops.flatMap(s => s.places.map(p => p.name.toLowerCase())));
  let added = 0;
  for (const {stop: stopId, ...sp} of SEEDS.places) {
    const s = byId(stopId) || (sp.lat != null ? rankStops(sp.lat, sp.lng)[0].s : null);
    if (!s || have.has(sp.name.toLowerCase())) continue;
    s.places.push({id: uid(), note: '', url: '', lat: null, lng: null, ...sp, cat: sp.cat || classify(sp.name, sp.note)});
    added++;
  }
  trip.imports.push(SEEDS.id); save(); renderAll();
  if (added) toast(`Added ${added} places from your Google Maps list.`);
}

// ═══ 13. CHECKS — runs on load; open with the "Checks" button ═════════════════
async function runChecks() {
  const R = [], add = (state, name, detail = '') => R.push({state, name, detail});

  const paths = $$('#land path');
  add(paths.length && paths.length === BASE.regions.length ? 'pass' : 'fail', 'Map loaded', `${paths.length} of ${BASE.regions.length} regions`);
  const corners = [[B_N, B_W, 0, 0], [B_S, B_E, MAP_W, MAP_H]];
  const err = Math.max(...corners.map(([la, ln, x, y]) => { const [px, py] = project(la, ln); return Math.hypot(px - x, py - y); }));
  add(err < 1 ? 'pass' : 'fail', 'Pins are positioned with the map’s own projection', `largest error ${err.toFixed(2)} units at the map’s corners`);

  trip.stops.forEach((s, i) => {
    const [x, y] = project(s.lat, s.lng), name = `${i + 1}. ${s.name} is in the right place`;
    if (!(x >= 0 && x <= MAP_W && y >= 0 && y <= MAP_H)) return add('fail', name, 'the pin falls outside the map');
    // Passes if any region under the pin is one of the stop's regionIds (a park and its state both count).
    const pt = $('#map').createSVGPoint(); pt.x = x; pt.y = y;
    const under = $$('#land path').reverse().filter(p => p.isPointInFill(pt)), hit = under[0], near = hit || regionAt(x, y, units(15));
    const ok = p => p && (!s.regionIds.length || s.regionIds.includes(p.dataset.rid));
    if (under.some(ok)) add('pass', name, `in ${under.find(ok).getAttribute('name')}`);
    else if (ok(near)) add('warn', name, `just outside ${near.getAttribute('name')}`);
    else add('fail', name, hit ? `lands in ${hit.getAttribute('name')}, expected ${s.regionIds.map(regionName).join(' or ')}` : 'lands outside every mapped region');
  });

  const bad = trip.stops.filter(s => !Number.isInteger(s.nights) || s.nights < 1);
  add(bad.length ? 'fail' : 'pass', 'Every stop has at least one night', bad.length ? bad.map(s => s.name).join(', ') : `${totalNights()} nights across ${trip.stops.length} stops`);
  add(!trip.stops[0].leg && trip.stops.slice(1).every(s => MODES[s.leg?.mode]) ? 'pass' : 'fail', 'Every move between stops has a travel leg');
  add(new Set(trip.stops.map(s => s.id)).size === trip.stops.length ? 'pass' : 'fail', 'Stops are uniquely identified');

  if (trip.startDate) {
    const clash = trip.stops.slice(1).map((s, j) => ({s, want: ymd(dateAt(nightsBefore(j + 1)))})).filter(({s, want}) => s.leg.depDate && s.leg.depDate !== want);
    add(clash.length ? 'warn' : 'pass', 'Booked travel dates match the plan',
      clash.length ? clash.map(({s, want}) => `${s.name}: booked ${s.leg.depDate}, plan moves on ${want}`).join('; ') : `trip runs ${fmt(dateAt(0))} to ${fmt(dateAt(totalNights()))}`);
  } else add('info', 'Booked travel dates match the plan', 'add a start date to check these');

  const places = trip.stops.flatMap(s => s.places.map(p => ({s, p})));
  const far = places.filter(({s, p}) => !p.side && p.lat != null && km(p.lat, p.lng, s.lat, s.lng) > FAR_KM);   // side trips are far on purpose
  add(far.length ? 'warn' : 'pass', 'Saved places are filed near their stop',
    far.length ? far.map(({s, p}) => `${p.name} is ${dist(km(p.lat, p.lng, s.lat, s.lng))} from ${s.name}`).join('; ') : `${places.length} saved places`);

  const uncategorised = places.filter(({p}) => !CATS.some(c => c.id === p.cat));
  add(uncategorised.length ? 'fail' : 'pass', 'Every saved place has a category', uncategorised.map(({p}) => p.name).join(', '));
  const CAT_SAMPLES = T.categorySamples || [['Grand Hotel','stay'],['Corner Bar','drink'],['Joe’s Diner','eat'],['City Museum','see'],['Riverside Park','nature'],['Kayak rentals','do'],['Book shop','shop'],['Blue Bottle Coffee','cafe']];
  const miss = CAT_SAMPLES.filter(([n, c]) => classify(n, '') !== c);
  add(miss.length ? 'fail' : 'pass', 'Places are sorted into categories correctly', miss.length ? miss.map(([n, c]) => `${n}: got ${classify(n, '')}, expected ${c}`).join('; ') : `${CAT_SAMPLES.length} examples tested`);
  if (IDEAS.length) {
    const badIdeas = IDEAS.filter(d => !WHERE_STOP[d.where] || ideaItems(d).some(it => !CATS.some(c => c.id === it.cat) || (it.where && !WHERE_STOP[it.where])));
    add(badIdeas.length ? 'fail' : 'pass', 'Saved-post ideas are tagged and filed', badIdeas.length ? badIdeas.map(d => d.title).join(', ') : `${IDEAS.length} ideas`);
    const missing = [...new Set(Object.values(WHERE_STOP))].filter(id => !byId(id));
    add(missing.length ? 'warn' : 'pass', 'Saved-post ideas have a stop to go to', missing.length ? `no stop called ${missing.join(', ')} — those ideas will default to the first stop` : '');
  }
  const SAMPLES = [
    ['https://www.google.com/maps/place/Old+Faithful/@44.4604788,-110.8302612,17z/data=!3m1!4b1!4m6!3m5!1s0x5351e55555555555:0x1!8m2!3d44.4604788!4d-110.8281012', 'Old Faithful', 44.4605, -110.8281],
    ['https://www.google.com/maps/search/?api=1&query=43.7904,-110.6818', '', 43.7904, -110.6818],
    ['Jenny Lake\nhttps://maps.google.com/?q=43.7532,-110.7239', 'Jenny Lake', 43.7532, -110.7239],
    ['https://www.google.com/maps/@35.6895,139.6917,14z', '', 35.6895, 139.6917],
    ['https://maps.app.goo.gl/28QK9YA48XZBVTBr9', '', null, null],
  ];
  const failed = SAMPLES.filter(([t, name, la, ln]) => { const p = parseMapsText(t); return p.name !== name || (la == null ? p.lat != null || !p.short : Math.abs(p.lat - la) > 1e-3 || Math.abs(p.lng - ln) > 1e-3); });
  add(failed.length ? 'fail' : 'pass', 'Google Maps links are read correctly', failed.length ? `failed on ${failed.map(f => f[0].slice(0, 40)).join(', ')}` : `${SAMPLES.length} link formats tested`);

  try { localStorage.setItem('__check', '1'); const ok = localStorage.getItem('__check') === '1'; localStorage.removeItem('__check');
    add(ok ? 'pass' : 'fail', 'This browser can save your changes'); }
  catch { add('fail', 'This browser can save your changes', 'storage is blocked, often by private browsing'); }
  const stored = readJSON(LS_KEY);
  add(!stored ? 'info' : stored.updatedAt === trip.updatedAt ? 'pass' : 'warn', 'Latest change is saved', !stored ? 'no changes made yet' : stored.updatedAt === trip.updatedAt ? `saved ${new Date(trip.updatedAt).toLocaleString()}` : 'the stored copy is older than what’s on screen');

  if (REMOTE) {
    try { const [row] = await rpc('get_trip', {p_key: TRIP_KEY});
      add(row ? (sync.dirty ? 'warn' : 'pass') : 'warn', 'Shared plan is in sync', !row ? 'connected, nothing shared yet' : sync.dirty ? 'your latest change hasn’t reached the shared copy yet' : `last shared save ${new Date(row.saved_at).toLocaleString()}`); }
    catch (e) { add('fail', 'Shared plan is in sync', `can’t reach the shared copy: ${e.message.slice(0, 80)}`); }
  } else add(TRIP_KEY && CONFIG.supabaseUrl ? 'warn' : 'info', 'Sharing with friends', !CONFIG.supabaseUrl ? 'not set up yet, so changes stay in this browser' : !TRIP_KEY ? 'add #trip=your-code to the page address to turn sharing on' : 'the trip code in the address needs at least 12 characters');
  if (CONFIG.resolverUrl) {
    try { const t = await (await fetch(`${CONFIG.resolverUrl}?url=${encodeURIComponent(SAMPLES[4][0])}`)).text();
      add(/google\.[a-z.]+\/maps/.test(t) ? 'pass' : 'fail', 'Short Maps links can be expanded', t.slice(0, 60)); }
    catch (e) { add('fail', 'Short Maps links can be expanded', e.message); }
  } else add('info', 'Short Maps links can be expanded', 'link expander not set up, so paste full links');
  return R;
}
function checksState(R) { return R.some(r => r.state === 'fail') ? 'fail' : R.some(r => r.state === 'warn') ? 'warn' : 'pass'; }
async function showChecks() {
  const R = await runChecks(), n = s => R.filter(r => r.state === s).length;
  $('#checks-btn').dataset.state = checksState(R);
  $('#checks-sum').textContent = `${n('pass')} passed, ${n('warn')} to look at, ${n('fail')} failed.`;
  $('#checks-list').innerHTML = R.map(r => `<li class="${r.state}"><b>${esc(r.name)}</b>${r.detail ? `<small>${esc(r.detail)}</small>` : ''}</li>`).join('');
  openDlg('#checks-dlg');
}
window.runChecks = runChecks;

// ═══ 14. START ════════════════════════════════════════════════════════════════
// The trip's name, colours and fonts, and the switcher when config.js lists several trips.
function applyTrip() {
  document.title = `${T.title} planner`;
  $('#trip-title').textContent = T.title;
  $('#trip-sub').textContent = T.subtitle || '';
  const root = document.documentElement;
  Object.entries(T.theme || {}).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
  if (T.fontsUrl) document.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" href="${esc(T.fontsUrl)}">`);
  $('#ideas-tab').hidden = !IDEAS.length;
  const trips = CONFIG.trips || [];
  if (trips.length > 1) {
    const sel = $('#trip-switch'); sel.hidden = false;
    sel.innerHTML = trips.map(t => `<option value="${esc(t.id)}"${t.id === T.id ? ' selected' : ''}>${esc(t.title || t.id)}</option>`).join('');
    sel.onchange = () => { location.href = `?trip=${encodeURIComponent(sel.value)}`; };   // the #trip= share code is per trip, so it's dropped
  }
}
applyTrip();
renderBasemap();
renderAll();
ui.view = clampView(viewAround(trip.stops.map(s => project(s.lat, s.lng)), MAP_W*.5)); renderOverlay();
setStatus(REMOTE ? 'saving' : 'local', REMOTE ? 'Connecting…' : undefined);
if (REMOTE) initRemote(); else mergeSeeds();
setPage(view.page === 'ideas' ? 'ideas' : 'plan');
runChecks().then(R => $('#checks-btn').dataset.state = checksState(R));