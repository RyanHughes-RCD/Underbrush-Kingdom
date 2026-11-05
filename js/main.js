// UI layer: renders state into the DOM and wires up taps.
import {
  CLASSES, CLASS_IDS, ITEMS, WEAPONS, WEAPON_TIERS, WORKSHOPS, EXPEDITIONS, EXPEDITION_IDS,
  ENCOUNTER_MINUTES, MIN_ENCOUNTERS, MAX_ENCOUNTERS, MAX_PARTY, LURE_MINUTES,
} from './data.js';
import * as G from './game.js';
import { CampScene } from './scene.js';
import * as S from './sprites.js';

const params = new URLSearchParams(location.search);
if (params.has('speed')) G.setTimeScale(Number(params.get('speed')));

let state = G.loadFromStorage() || G.newGame();
const ui = {
  tab: 'camp',
  expType: null,         // expedition being planned
  party: [],             // creature ids chosen for it
  count: 3,              // encounters chosen
};

const $ = (sel) => document.querySelector(sel);
const view = $('#view');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function save() { G.saveToStorage(state); }

function fmtDuration(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}
function fmtMinutes(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}
const icon = (id, cls = '') => `<img class="${cls}" src="${(ITEMS[id] || WEAPONS[id]).icon}" alt="${esc((ITEMS[id] || WEAPONS[id]).name)}">`;
const sprite = (cls, size = 32, c = '') => S.creatureImg(S.creatureArt(cls), size, c);
const equippedIds = (c) => { const w = G.getWeapon(state, c.weaponId); return w ? [S.weaponPieceId(w.type, w.tier)] : []; };
const creatureArt = (c) => S.creatureArt(c.cls, equippedIds(c));
const creatureSprite = (c, size, cls = '') => S.creatureImg(creatureArt(c), size, cls);
const pieceIcon = (type, tier, size = 32) => {
  const art = S.pieceArt(S.weaponPieceId(type, tier));
  return art ? `<img src="${art.url}" alt="" style="width:${size}px;height:${size * art.h / art.w}px">` : icon(type);
};
const weaponIcon = (w) => pieceIcon(w.type, w.tier);
const countdown = (endsAt) => `<span data-ends="${endsAt}">${fmtDuration(endsAt - Date.now())}</span>`;
const lootText = (loot) => Object.entries(loot).map(([k, q]) => `${icon(k)}×${q}`).join(' ');

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 2600);
}

// ---------- Satchel ----------

function renderSatchel() {
  $('#satchel').innerHTML = Object.keys(ITEMS).map((k) => {
    const q = state.inventory[k] || 0;
    return `<span class="it ${q ? '' : 'zero'}" title="${esc(ITEMS[k].name)}">${icon(k)}${q}</span>`;
  }).join('');
}

// ---------- Camp ----------

function creatureCard(c) {
  const w = G.getWeapon(state, c.weaponId);
  const busy = G.isBusy(state, c.id);
  const xpPct = Math.round((c.xp / G.xpToNext(c.level)) * 100);
  return `
    <button class="creature ${busy ? 'busy' : ''}" data-action="creature" data-id="${c.id}">
      <div class="portrait">${creatureSprite(c, 128, 'sprite')}</div>
      <div class="name">${esc(c.name)}</div>
      <div class="cls">${CLASSES[c.cls].name} · Lv ${c.level}</div>
      <div class="bar xp" title="XP"><i style="width:${xpPct}%"></i></div>
      <div class="row small"><span class="grow">Power ${G.creaturePower(state, c)}</span>${busy ? '<span class="tag away">Away</span>' : ''}</div>
    </button>`;
}

function awayNote() {
  const away = state.creatures.filter((c) => G.isBusy(state, c.id)).length;
  return away ? `<p class="hint scene-note">${away} fighter${away > 1 ? 's are' : ' is'} out on an expedition.</p>` : '';
}

const scene = new CampScene({ onTap: (id) => openCreature(id) });

function mountScene() {
  const slot = document.getElementById('scene-slot');
  if (!slot) { scene.stop(); return; }
  slot.replaceWith(scene.el);
  scene.resize();
  scene.setCreatures(state.creatures.filter((c) => !G.isBusy(state, c.id)).map((c) => ({ id: c.id, cls: c.cls, art: creatureArt(c) })));
  if (!document.hidden) scene.start();
}

function renderCamp() {
  const free = G.freeWeapons(state);
  const lures = state.lures;
  return `
    <div id="scene-slot"></div>
    ${awayNote()}
    <h2>Your Band (${state.creatures.length})</h2>
    <p class="hint">Tap a fighter to see details or hand them a weapon.</p>
    <div class="roster">${state.creatures.map(creatureCard).join('')}</div>

    <h2>The Lure Post</h2>
    <p class="hint">Leave a crafted weapon here and a new fighter of its class will come to claim it (${fmtMinutes(LURE_MINUTES)}).</p>
    <div class="card">
      ${lures.length ? `<div class="weapon-list">${lures.map((l) => {
        const w = G.getWeapon(state, l.weaponId);
        return `<div class="weapon-row">${weaponIcon(w)}<div class="grow small">${esc(G.weaponName(w))}<br><span class="muted">A ${CLASSES[l.cls].name} approaches… ${countdown(l.endsAt)}</span></div></div>`;
      }).join('')}</div>` : ''}
      ${free.length ? `<div class="weapon-list" style="margin-top:${lures.length ? 10 : 0}px">${free.map((w) => `
        <div class="weapon-row">${weaponIcon(w)}<div class="grow small">${esc(G.weaponName(w))} <span class="muted">+${G.weaponPower(w)}</span></div>
          <button class="btn sm green" data-action="lure" data-id="${w.id}">Lure</button></div>`).join('')}</div>`
        : (lures.length ? '' : '<p>No spare weapons. Craft some at the Workshops.</p>')}
    </div>

    <h2>Camp Journal</h2>
    <div class="card"><ul class="log">${state.log.slice(0, 15).map((l) => `<li>${esc(l.text)}</li>`).join('')}</ul></div>
    <button class="btn ghost sm" data-action="reset">Start over</button>`;
}

function openCreature(id) {
  const c = G.getCreature(state, id);
  const w = G.getWeapon(state, c.weaponId);
  const busy = G.isBusy(state, c.id);
  const options = G.freeWeapons(state).filter((x) => WEAPONS[x.type].cls === c.cls);
  openModal(`
    <div class="row">${creatureSprite(c, 96, 'portrait-lg')}<div class="grow">
      <h3>${esc(c.name)}</h3>
      <div class="small">${CLASSES[c.cls].name} · Level ${c.level} · Power ${G.creaturePower(state, c)}</div>
      <div class="small muted">XP ${c.xp}/${G.xpToNext(c.level)}</div>
    </div></div>
    <p class="small">${esc(CLASSES[c.cls].blurb)}</p>
    <div class="ws-section">
      <div class="small"><b>Weapon:</b> ${w ? `${esc(G.weaponName(w))} (+${G.weaponPower(w)})` : 'Bare claws'}</div>
      ${busy ? '<p class="small">Away on an expedition.</p>' : `
        <div class="weapon-list" style="margin-top:8px">
          ${options.map((o) => `<div class="weapon-row">${weaponIcon(o)}<div class="grow small">${esc(G.weaponName(o))} +${G.weaponPower(o)}</div>
            <button class="btn sm green" data-action="equip" data-id="${c.id}" data-weapon="${o.id}">Equip</button></div>`).join('')
            || `<p class="small muted">No spare ${WEAPONS[CLASSES[c.cls].weapon].name.toLowerCase()}s in the armory.</p>`}
          ${w ? `<button class="btn sm ghost" data-action="equip" data-id="${c.id}" data-weapon="">Unequip</button>` : ''}
        </div>`}
    </div>
    <button class="btn block ghost" style="margin-top:12px" data-action="close">Close</button>`);
}

// ---------- Expeditions ----------

function demandIcons(exp) {
  const counts = {};
  for (const e of exp.encounters) counts[e.demand] = (counts[e.demand] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
    .map(([cls, n]) => `<span class="row small" style="gap:0">${sprite(cls, 32)}×${n}</span>`).join('');
}

function renderPlanner() {
  const exp = EXPEDITIONS[ui.expType];
  ui.party = ui.party.filter((id) => G.getCreature(state, id) && !G.isBusy(state, id));
  const err = G.canStartExpedition(state, ui.expType, ui.party, ui.count);
  const prev = ui.party.length ? G.previewExpedition(state, ui.expType, ui.party, ui.count) : null;
  return `
    <div class="card">
      <h3>Plan: ${esc(exp.name)}</h3>
      <div class="small"><b>Party</b> <span class="muted">(up to ${MAX_PARTY})</span></div>
      <div class="picker">
        ${state.creatures.map((c) => {
          const busy = G.isBusy(state, c.id);
          return `<button class="pick ${ui.party.includes(c.id) ? 'on' : ''}" data-action="toggle-party" data-id="${c.id}" ${busy ? 'disabled' : ''}>
            ${creatureSprite(c, 64)}${esc(c.name)}<br><span class="muted">${busy ? 'Away' : `Pow ${G.creaturePower(state, c)}`}</span></button>`;
        }).join('')}
      </div>
      <div class="row">
        <div class="grow small"><b>Encounters</b><br><span class="muted">${ENCOUNTER_MINUTES} min each</span></div>
        <div class="stepper">
          <button class="btn ghost" data-action="count" data-d="-1" ${ui.count <= MIN_ENCOUNTERS ? 'disabled' : ''}>−</button>
          <span class="val">${ui.count}</span>
          <button class="btn ghost" data-action="count" data-d="1" ${ui.count >= MAX_ENCOUNTERS ? 'disabled' : ''}>+</button>
        </div>
      </div>
      <p class="odds">Journey length: <b>${fmtMinutes(ui.count * ENCOUNTER_MINUTES)}</b>
        ${prev ? `<br>Expected wins: <b>${prev.expectedWins.toFixed(1)} / ${ui.count}</b> (${Math.round(prev.avgChance * 100)}% avg)` : ''}</p>
      <div class="row">
        <button class="btn ghost" data-action="cancel-plan">Back</button>
        <button class="btn green grow" data-action="start-exp" ${err ? 'disabled' : ''}>Set out!</button>
      </div>
      ${err && ui.party.length ? `<p class="small" style="color:var(--warn)">${esc(err)}</p>` : ''}
    </div>`;
}

function activeExpeditionCard(e) {
  const exp = EXPEDITIONS[e.type];
  const now = Date.now();
  const done = G.encountersDone(e, now);
  const complete = done >= e.encounters.length;
  const pct = Math.min(100, ((now - e.startedAt) / (e.encounters.length * e.encounterMs)) * 100);
  const items = e.encounters.map((enc, i) => {
    if (i < done) {
      return `<li>${sprite(enc.demand, 32)}<span class="grow">${esc(enc.name)}</span>
        <span class="${enc.success ? 'win' : 'lose'}">${enc.success ? 'Won' : 'Fled'}</span>
        <span class="loot-icons">${lootText(enc.loot)}</span></li>`;
    }
    if (i === done) return `<li class="pending">⋯ Encounter ${i + 1} in progress (${countdown(e.startedAt + (i + 1) * e.encounterMs)})</li>`;
    return '';
  }).join('') + (done + 1 < e.encounters.length ? `<li class="pending">${e.encounters.length - done - 1} more ahead</li>` : '');
  return `
    <div class="card">
      <div class="row">
        <div class="grow"><h3>${esc(exp.name)}</h3>
          <div class="small muted">${done}/${e.encounters.length} encounters · ${complete ? 'Back at camp!' : countdown(G.expeditionEndsAt(e)) + ' left'}</div></div>
        <div class="party-strip">${e.partyIds.map((id) => { const c = G.getCreature(state, id); return c ? creatureSprite(c, 64) : ''; }).join('')}</div>
      </div>
      <div class="bar" style="margin:6px 0"><i style="width:${pct}%"></i></div>
      <ul class="enc-list">${items}</ul>
      <div style="margin-top:8px">
        ${complete
          ? `<button class="btn green block" data-action="claim" data-id="${e.id}">Collect rewards</button>`
          : `<button class="btn ghost sm" data-action="recall" data-id="${e.id}">Recall early</button>`}
      </div>
    </div>`;
}

function renderExpeditions() {
  const active = state.expeditions;
  return `
    ${active.length ? `<h2>Out in the Underbrush</h2>${active.map(activeExpeditionCard).join('')}` : ''}
    <h2>Choose an Expedition</h2>
    <p class="hint">Each encounter takes ${ENCOUNTER_MINUTES} minutes. Fighters whose class matches an encounter count for more.</p>
    ${ui.expType ? renderPlanner() : ''}
    ${EXPEDITION_IDS.map((id) => {
      const exp = EXPEDITIONS[id];
      const best = Object.entries(exp.loot).sort((a, b) => b[1] - a[1]);
      return `
      <div class="card exp-card ${ui.expType === id ? 'selected' : ''}" data-action="plan" data-id="${id}">
        <h3>${esc(exp.name)}</h3>
        <p>${esc(exp.blurb)}</p>
        <div class="demands"><span class="small">Demands:</span> ${demandIcons(exp)}</div>
        <div class="small loot-icons">Finds: ${best.map(([k, w]) => `${icon(k)}${w >= 5 ? '' : '<span class="muted">(rare)</span>'}`).join(' ')}</div>
      </div>`;
    }).join('')}`;
}

// ---------- Workshops ----------

function renderWorkshops() {
  return `
    <h2>Workshops</h2>
    <p class="hint">Process scrap into materials, then craft weapons for your fighters.</p>
    ${Object.values(WORKSHOPS).map((ws) => {
      const jobs = G.workshopJobs(state, ws.id);
      const have = state.inventory[ws.input] || 0;
      const maxBatches = Math.floor(have / ws.inputQty);
      const wpn = WEAPONS[ws.weapon];
      return `
      <div class="card">
        <div class="ws-head">
          <div class="grow"><h3>${esc(ws.name)}</h3><p>${esc(ws.blurb)}</p></div>
        </div>
        <div class="ws-head"><div class="recipe">${icon(ws.input)}×${ws.inputQty} → ${icon(ws.output)}×${ws.outputQty}
          <span class="muted">(${fmtMinutes(ws.minutes)})</span></div></div>
        <div class="row" style="margin-top:6px">
          <button class="btn sm" data-action="process" data-id="${ws.id}" data-n="1" ${maxBatches < 1 ? 'disabled' : ''}>Process 1</button>
          <button class="btn sm ghost" data-action="process" data-id="${ws.id}" data-n="${maxBatches}" ${maxBatches < 2 ? 'disabled' : ''}>All (${maxBatches})</button>
        </div>
        ${jobs.length ? `<p class="small">Working: ${jobs.length} batch${jobs.length > 1 ? 'es' : ''} · next in ${countdown(jobs[0].endsAt)} · all done in ${countdown(jobs[jobs.length - 1].endsAt)}</p>` : ''}
        <div class="ws-section">
          <div class="small" style="margin-bottom:6px"><b>Craft a ${wpn.name}</b> <span class="muted">for ${CLASSES[wpn.cls].plural}</span></div>
          <div class="tiers">
            ${WEAPON_TIERS.map((t) => `
              <button class="btn ${ws.id === 'enchanter' ? 'purple' : ws.id === 'forge' ? '' : 'green'}" data-action="craft" data-type="${wpn.id}" data-tier="${t.tier}"
                ${G.canCraft(state, wpn.id, t.tier) ? 'disabled' : ''}>
                ${pieceIcon(wpn.id, t.tier)}${t.prefix}<span>+${t.power} · ${t.cost}${icon(wpn.material, '')}</span></button>`).join('')}
          </div>
        </div>
      </div>`;
    }).join('')}`;
}

// ---------- Render loop ----------

function render() {
  renderSatchel();
  view.innerHTML = ui.tab === 'camp' ? renderCamp() : ui.tab === 'expeditions' ? renderExpeditions() : renderWorkshops();
  mountScene();
  const ready = state.expeditions.some((e) => G.isExpeditionComplete(e));
  document.querySelectorAll('#tabs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === ui.tab);
    b.querySelector('.dot')?.remove();
    if (b.dataset.tab === 'expeditions' && ready) b.insertAdjacentHTML('beforeend', '<span class="dot"></span>');
  });
}

// What visibly changes over time without a state change.
function timeSignature() {
  const now = Date.now();
  return state.expeditions.map((e) => `${e.id}:${G.encountersDone(e, now)}`).join(',');
}
let lastSig = '';

function loop() {
  if (G.tick(state)) { save(); render(); }
  const sig = timeSignature();
  if (sig !== lastSig) { lastSig = sig; render(); return; }
  const now = Date.now();
  document.querySelectorAll('[data-ends]').forEach((el) => { el.textContent = fmtDuration(Number(el.dataset.ends) - now); });
}

function act(fn) {
  try { fn(); save(); render(); } catch (err) { toast(err.message); }
}

// ---------- Events ----------

$('#tabs').addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-tab]');
  if (!b) return;
  ui.tab = b.dataset.tab;
  render();
  view.scrollTop = 0;
});

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const { action, id } = el.dataset;
  switch (action) {
    case 'creature': openCreature(id); break;
    case 'close': closeModal(); break;
    case 'equip':
      act(() => G.equipWeapon(state, id, el.dataset.weapon || null));
      openCreature(id);
      break;
    case 'lure': act(() => { G.startLure(state, id); toast('The weapon gleams at the Lure Post…'); }); break;
    case 'plan':
      if (ui.expType !== id) {
        ui.expType = id;
        ui.party = state.creatures.filter((c) => !G.isBusy(state, c.id)).slice(0, MAX_PARTY).map((c) => c.id);
        render();
        view.querySelector('.picker')?.closest('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      break;
    case 'cancel-plan': ui.expType = null; render(); break;
    case 'toggle-party':
      ui.party = ui.party.includes(id) ? ui.party.filter((x) => x !== id)
        : ui.party.length < MAX_PARTY ? [...ui.party, id] : ui.party;
      render();
      break;
    case 'count':
      ui.count = Math.min(MAX_ENCOUNTERS, Math.max(MIN_ENCOUNTERS, ui.count + Number(el.dataset.d)));
      render();
      break;
    case 'start-exp':
      act(() => { G.startExpedition(state, ui.expType, ui.party, ui.count); ui.expType = null; ui.party = []; });
      view.scrollTop = 0;
      break;
    case 'claim': act(() => { const r = G.claimExpedition(state, id); toast(`Won ${r.wins}/${r.done} encounters!`); }); break;
    case 'recall':
      if (confirm('Recall this party now? They keep loot from finished encounters only.')) act(() => G.claimExpedition(state, id));
      break;
    case 'process': act(() => G.startProcessing(state, id, Number(el.dataset.n))); break;
    case 'craft': act(() => { const w = G.craftWeapon(state, el.dataset.type, Number(el.dataset.tier)); toast(`Crafted a ${G.weaponName(w)}!`); }); break;
    case 'reset':
      if (confirm('Erase your kingdom and start over?')) { G.clearStorage(); state = G.newGame(); save(); ui.expType = null; render(); }
      break;
  }
});

function openModal(html) {
  const m = $('#modal');
  m.innerHTML = `<div class="sheet">${html}</div>`;
  m.hidden = false;
}
function closeModal() { $('#modal').hidden = true; }
$('#modal').addEventListener('click', (ev) => { if (ev.target.id === 'modal') closeModal(); });

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { loop(); if (ui.tab === 'camp') scene.start(); } else { save(); scene.stop(); }
});

// Boot
await S.loadSprites();
G.tick(state);
save();
render();
lastSig = timeSignature();
setInterval(loop, 1000);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
