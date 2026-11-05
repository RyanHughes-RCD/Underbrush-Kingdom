// UI layer: renders state into the DOM and wires up taps.
import {
  CLASSES, CLASS_IDS, ITEMS, WEAPONS, WORKSHOPS, EXPEDITIONS, EXPEDITION_IDS,
  SCRAPS, MATERIALS, FAMILIES, MAX_BATCH, WEAPON_COST, TIER_NAMES, STATS, STAT_IDS, ACCENT_WORD,
  ENCOUNTER_MINUTES, MIN_ENCOUNTERS, MAX_ENCOUNTERS, MAX_PARTY, LURE_MINUTES,
} from './data.js';
import * as G from './game.js';
import { CampScene } from './scene.js';
import * as S from './sprites.js';
import * as ST from './stats.js';

const params = new URLSearchParams(location.search);
if (params.has('speed')) G.setTimeScale(Number(params.get('speed')));

let state = G.loadFromStorage() || G.newGame();
const ui = {
  tab: 'camp',
  expType: null,         // expedition being planned
  party: [],             // creature ids chosen for it
  count: 3,              // encounters chosen
  smelt: { woodworker: 3, forge: 3, enchanter: 3 }, // pieces per batch
  craft: {},             // workshop id -> {type, material, accent} being planned
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
const equippedIds = (c) => { const w = G.getWeapon(state, c.weaponId); return w ? [{ type: w.type, material: w.material, accent: w.accent }] : []; };
const creatureArt = (c) => S.creatureArt(c.cls, equippedIds(c));
const creatureSprite = (c, size, cls = '') => S.creatureImg(creatureArt(c), size, cls);
const pieceIcon = (type, material, accent, size = 32) => {
  const art = S.weaponArt(type, material, accent);
  return art ? `<img src="${art.url}" alt="" style="width:${size}px;height:${size * art.h / art.w}px">` : icon(type);
};
const weaponIcon = (w) => pieceIcon(w.type, w.material, w.accent);
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
  const scraps = Object.keys(SCRAPS).map((k) => {
    const q = state.inventory[k] || 0;
    return `<span class="it ${q ? '' : 'zero'}" title="${esc(ITEMS[k].name)}">${icon(k)}${q}</span>`;
  });
  const fams = Object.values(FAMILIES).map((f) => {
    const q = f.list.reduce((n, m) => n + (state.inventory[m.id] || 0), 0);
    return `<span class="it ${q ? '' : 'zero'}" title="${esc(f.name)}"><img src="assets/items/${f.base}.png" alt="${esc(f.name)}">${q}</span>`;
  });
  $('#satchel').innerHTML = [...scraps, '<span class="sep"></span>', ...fams].join('');
}

// ---------- Stats ----------

/** "ATK 9 · STR C · DEX D" for a weapon profile. */
const profileText = (p) => `ATK ${p.attack} · ${p.scaling.map((x) => `${STATS[x.stat].short} ${x.grade}`).join(' · ')}`;
const profileTags = (p) => `<span class="ptag atk">ATK ${p.attack}</span>${p.scaling.map((x) => `<span class="ptag g-${x.grade}">${STATS[x.stat].short} ${x.grade}</span>`).join('')}`;

function statBlock(c) {
  const st = G.creatureStats(c);
  const gain = ST.nextLevelGain(c.cls, c.level);
  const cell = (id) => `<div class="stat ${STATS[id].group}"><span class="sname">${STATS[id].short}</span><b>${st[id]}</b>${gain[id] ? `<i>+${gain[id]}</i>` : '<i></i>'}</div>`;
  return `<div class="stat-sheet">
      ${cell('hp')}
      <div class="stat-group"><span class="glabel">Offense</span>${['str', 'dex', 'int'].map(cell).join('')}</div>
      <div class="stat-group"><span class="glabel">Defense</span>${['mig', 'spi', 'lck'].map(cell).join('')}</div>
    </div>
    <p class="hint small" style="margin:4px 0 0">Small numbers show what the next level adds.</p>`;
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
        <div class="weapon-row">${weaponIcon(w)}<div class="grow small">${esc(G.weaponName(w))}<br><span class="muted">${profileText(G.weaponProfile(w))}</span></div>
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
      <div class="small">${CLASSES[c.cls].name} · Level ${c.level}</div>
      <div class="small">Power <b>${G.creaturePower(state, c)}</b> · Damage <b>${G.creatureDamage(state, c)}</b></div>
      <div class="small muted">XP ${c.xp}/${G.xpToNext(c.level)}</div>
    </div></div>
    <p class="small">${esc(CLASSES[c.cls].blurb)}</p>
    ${statBlock(c)}
    <div class="ws-section">
      <div class="small"><b>Weapon:</b> ${w ? `${esc(G.weaponName(w))}<div class="ptags">${profileTags(G.weaponProfile(w))}</div>` : `Bare claws <span class="muted">(half ${{ archer: 'DEX', knight: 'STR', mage: 'INT' }[c.cls]})</span>`}</div>
      ${busy ? '<p class="small">Away on an expedition.</p>' : `
        <div class="weapon-list" style="margin-top:8px">
          ${options.map((o) => { const d = G.creatureDamage(state, c, o) - G.creatureDamage(state, c); return `<div class="weapon-row">${weaponIcon(o)}<div class="grow small">${esc(G.weaponName(o))}<br><span class="muted">${profileText(G.weaponProfile(o))}</span>
            <br><span class="${d > 0 ? 'up' : d < 0 ? 'down' : 'muted'}">Damage ${G.creatureDamage(state, c, o)} (${d >= 0 ? '+' : ''}${d})</span></div>
            <button class="btn sm green" data-action="equip" data-id="${c.id}" data-weapon="${o.id}">Equip</button></div>`; }).join('')
            || `<p class="small muted">No spare ${CLASSES[c.cls].weapons.map((t) => WEAPONS[t].name.toLowerCase() + 's').join(' or ')} in the armory.</p>`}
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

const pct = (p) => (p >= 0.995 ? '>99%' : p < 0.005 ? '<1%' : `${Math.round(p * 100)}%`);

function renderWorkshops() {
  return `
    <h2>Workshops</h2>
    <p class="hint">Put scrap into a workshop to smelt it. The more you put in, the better your odds of a rare material. Each batch makes one material.</p>
    ${Object.values(WORKSHOPS).map((ws) => {
      const sc = SCRAPS[ws.input];
      const have = state.inventory[ws.input] || 0;
      const n = Math.max(1, Math.min(ui.smelt[ws.id], MAX_BATCH));
      const odds = G.smeltOdds(ws.input, n);
      const jobs = G.workshopJobs(state, ws.id);
      const fam = FAMILIES[ws.family];
      const types = CLASSES[ws.cls].weapons.map((t) => WEAPONS[t]);
      const owned = fam.list.filter((m) => state.inventory[m.id] > 0);
      const seen = new Set(state.discovered || []);
      return `
      <div class="card">
        <h3>${esc(ws.name)}</h3>
        <p>${esc(ws.blurb)}</p>

        <div class="ws-section">
          <div class="row">
            <div class="grow small"><b>Smelt ${esc(sc.name)}s</b><br><span class="muted">You have ${have} · value ${sc.value} each · batch value ${sc.value * n}</span></div>
            <div class="stepper">
              <button class="btn ghost sm" data-action="smelt-n" data-id="${ws.id}" data-d="-1" ${n <= 1 ? 'disabled' : ''}>−</button>
              <span class="val">${n}</span>
              <button class="btn ghost sm" data-action="smelt-n" data-id="${ws.id}" data-d="1" ${n >= MAX_BATCH ? 'disabled' : ''}>+</button>
            </div>
          </div>
          <ul class="odds-list">
            ${odds.map((o) => `<li>${seen.has(o.material) ? icon(o.material) : '<span class="unknown">?</span>'}
              <span class="grow">${seen.has(o.material) ? esc(MATERIALS[o.material].name) : `Tier ${o.tier} ${fam.name.toLowerCase().slice(0, -1)}`}</span>
              <span class="obar"><i style="width:${Math.max(2, o.p * 100)}%"></i></span><span class="pct">${pct(o.p)}</span></li>`).join('')}
          </ul>
          <button class="btn block" data-action="smelt" data-id="${ws.id}" data-n="${n}" ${have < n ? 'disabled' : ''}>
            Smelt ${n} ${esc(sc.name)}${n > 1 ? 's' : ''} <span class="muted-inv">(${fmtMinutes(ws.minutes)})</span></button>
          ${jobs.length ? `<ul class="jobs">${jobs.map((j, i) => `<li><span class="unknown">?</span><span class="grow">${j.count} ${esc(ITEMS[j.input].name)}${j.count > 1 ? 's' : ''}</span>
            <span class="muted">${i === 0 || j.startsAt <= Date.now() ? `ready in ${countdown(j.endsAt)}` : `queued · ${countdown(j.endsAt)}`}</span></li>`).join('')}</ul>` : ''}
        </div>

        <div class="ws-section">
          <div class="small" style="margin-bottom:6px"><b>${esc(fam.name)}</b> <span class="muted">${seen.size ? `${fam.list.filter((m) => seen.has(m.id)).length}/10 discovered` : ''}</span></div>
          <div class="mat-grid">
            ${fam.list.map((m, i) => {
              const q = state.inventory[m.id] || 0;
              return seen.has(m.id)
                ? `<button class="mat ${q ? '' : 'none'}" data-action="material" data-id="${m.id}" title="${esc(m.name)}">${icon(m.id)}<span>${q}</span></button>`
                : `<div class="mat locked" title="Undiscovered tier ${i + 1}"><span class="unknown">?</span><span>${i + 1}</span></div>`;
            }).join('')}
          </div>
        </div>

        ${craftPanel(ws, types)}
      </div>`;
    }).join('')}`;
}

/** The workshop's weapon bench: pick a type, a main material and fittings. */
function craftPanel(ws, types) {
  const fam = ws.family, accFam = types[0].accentFamily;
  const have = (id) => state.inventory[id] || 0;
  const mains = FAMILIES[fam].list.filter((m) => have(m.id) > 0);
  const accents = FAMILIES[accFam].list.filter((m) => have(m.id) > 0);
  const plan = ui.craft[ws.id] = ui.craft[ws.id] || {};
  if (!types.some((t) => t.id === plan.type)) plan.type = types[0].id;
  if (!mains.some((m) => m.id === plan.material)) plan.material = (mains.find((m) => have(m.id) >= WEAPON_COST.main) || mains[0])?.id;
  if (!accents.some((m) => m.id === plan.accent)) plan.accent = accents[0]?.id;
  const chip = (m, role, need) => `<button class="mchip ${plan[role] === m.id ? 'on' : ''} ${have(m.id) < need ? 'short' : ''}" data-action="plan-craft" data-id="${ws.id}" data-role="${role}" data-value="${m.id}">
      ${icon(m.id)}<span>${esc(m.name)}</span><i>${have(m.id)}/${need}</i></button>`;
  const head = `<div class="small" style="margin-bottom:6px"><b>Weapon bench</b> <span class="muted">for ${CLASSES[ws.cls].plural} · ${WEAPON_COST.main} ${FAMILIES[fam].name.toLowerCase()} + ${WEAPON_COST.accent} ${FAMILIES[accFam].name.toLowerCase().slice(0, -1)}</span></div>`;
  if (!mains.length || !accents.length) {
    const need = [!mains.length && `some ${FAMILIES[fam].name.toLowerCase()} here`, !accents.length && `some ${FAMILIES[accFam].name.toLowerCase()} at the ${Object.values(WORKSHOPS).find((w) => w.family === accFam).name}`].filter(Boolean).join(' and ');
    return `<div class="ws-section">${head}<p class="small muted">Weapons need two materials. Smelt ${need} first.</p></div>`;
  }
  const w = { type: plan.type, material: plan.material, accent: plan.accent };
  const prof = ST.weaponProfile(w.type, w.material, w.accent);
  const err = G.canCraft(state, w.type, w.material, w.accent);
  return `<div class="ws-section">${head}
    <div class="seg">${types.map((t) => `<button class="${t.id === plan.type ? 'on' : ''}" data-action="plan-craft" data-id="${ws.id}" data-role="type" data-value="${t.id}">${esc(t.name)}</button>`).join('')}</div>
    <div class="small bench-label">${esc(FAMILIES[fam].name.slice(0, -1))} <span class="muted">· the weapon itself (counts double)</span></div>
    <div class="mchips">${mains.map((m) => chip(m, 'material', WEAPON_COST.main)).join('')}</div>
    <div class="small bench-label">Fittings <span class="muted">· ${esc(FAMILIES[accFam].name.toLowerCase())}</span></div>
    <div class="mchips">${accents.map((m) => chip(m, 'accent', WEAPON_COST.accent)).join('')}</div>
    <div class="bench-preview">
      <div class="bench-art">${pieceIcon(w.type, w.material, w.accent, 48)}</div>
      <div class="grow small"><b>${esc(G.weaponName(w))}</b><div class="ptags">${profileTags(prof)}</div>
        <span class="muted">Quality ×${prof.quality} · ${esc(WEAPONS[w.type].blurb)}</span></div>
    </div>
    <button class="btn block green" data-action="craft" data-id="${ws.id}" ${err ? 'disabled' : ''}>${err ? esc(err) : `Craft ${esc(G.weaponName(w))}`}</button>
  </div>`;
}

function openMaterial(id) {
  const m = MATERIALS[id];
  const fam = FAMILIES[m.family];
  const types = Object.values(WEAPONS).filter((w) => w.family === m.family);
  const fitsFor = Object.values(WEAPONS).filter((w) => w.accentFamily === m.family);
  openModal(`
    <div class="row">${icon(m.id, 'mat-lg')}<div class="grow">
      <h3>${esc(m.name)}</h3>
      <div class="small muted">${esc(fam.name.slice(0, -1))} · tier ${m.tier} · ${TIER_NAMES[m.tier - 1]}</div>
    </div></div>
    <p class="small">${esc(m.blurb)}</p>
    <p class="small">You have <b>${state.inventory[m.id] || 0}</b>. Quality <b>×${m.quality}</b>. A weapon's quality is two parts main material to one part fittings.</p>
    <div class="small"><b>As the main material</b> <span class="muted">(with basic fittings)</span></div>
    <div class="stack-list">${types.map((t) => { const acc = FAMILIES[t.accentFamily].list[0].id; const w = { type: t.id, material: m.id, accent: acc };
      return `<div class="weapon-row">${pieceIcon(t.id, m.id, acc, 40)}<div class="grow small"><b>${esc(G.weaponName(w))}</b><div class="ptags">${profileTags(ST.weaponProfile(t.id, m.id, acc))}</div></div></div>`; }).join('')}</div>
    <div class="small"><b>As fittings</b> for ${fitsFor.map((t) => `${CLASSES[t.cls].plural.toLowerCase()}' ${t.name.toLowerCase()}s`).filter((x, i, a) => a.indexOf(x) === i).join(' and ')}</div>
    <div class="stack-list">${fitsFor.map((t) => { const main = FAMILIES[t.family].list[0].id; const w = { type: t.id, material: main, accent: m.id };
      return `<div class="weapon-row">${pieceIcon(t.id, main, m.id, 40)}<div class="grow small"><b>${esc(G.weaponName(w))}</b><div class="ptags">${profileTags(ST.weaponProfile(t.id, main, m.id))}</div></div></div>`; }).join('')}</div>
    <button class="btn block ghost" data-action="close">Close</button>`);
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
  const before = state.recent?.[0]?.t;
  if (G.tick(state)) {
    save(); render();
    const r = state.recent?.[0];
    if (r && r.t !== before) toast(`New material: ${MATERIALS[r.material].name}!`);
  }
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
    case 'smelt-n': ui.smelt[id] = Math.max(1, Math.min(MAX_BATCH, ui.smelt[id] + Number(el.dataset.d))); render(); break;
    case 'smelt': act(() => G.startSmelting(state, id, Number(el.dataset.n))); break;
    case 'material': openMaterial(id); break;
    case 'plan-craft': ui.craft[id] = { ...ui.craft[id], [el.dataset.role]: el.dataset.value }; render(); break;
    case 'craft': act(() => { const p = ui.craft[id]; const w = G.craftWeapon(state, p.type, p.material, p.accent); toast(`Crafted ${G.withArticle(G.weaponName(w))}!`); }); break;
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
