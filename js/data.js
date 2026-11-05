// Static game data: classes, items, expeditions, workshops and recipes.
// Everything tunable about the game's balance lives in this file.

export const ENCOUNTER_MINUTES = 10;
export const MIN_ENCOUNTERS = 1;
export const MAX_ENCOUNTERS = 12;
export const MAX_PARTY = 3;

export const CLASSES = {
  archer: {
    id: 'archer',
    name: 'Archer Lizard',
    plural: 'Archer Lizards',
    sprite: 'assets/sprites/archer-lizard.png',
    weapons: ['longbow', 'recurve'],
    blurb: 'Sharp-eyed and patient. Picks off threats from the tall grass.',
    names: ['Fern', 'Sizzle', 'Ember', 'Basil', 'Copper', 'Rusk', 'Tango', 'Sorrel', 'Pip', 'Cinder', 'Mango', 'Saffron'],
  },
  knight: {
    id: 'knight',
    name: 'Beetle Knight',
    plural: 'Beetle Knights',
    sprite: 'assets/sprites/beetle-knight.png',
    weapons: ['sword', 'mace'],
    blurb: 'Armoured and stubborn. Charges head-first into anything.',
    names: ['Sir Clover', 'Dame Moss', 'Sir Bramble', 'Dame Ivy', 'Sir Thistle', 'Dame Sage', 'Sir Burdock', 'Dame Juniper', 'Sir Oakley', 'Dame Briar'],
  },
  mage: {
    id: 'mage',
    name: 'Wizard Mouse',
    plural: 'Wizard Mice',
    sprite: 'assets/sprites/wizard-mouse.png',
    weapons: ['staff', 'tome'],
    blurb: 'Small, clever, and full of strange sparks.',
    names: ['Whisker', 'Nib', 'Mumble', 'Thimble', 'Crumb', 'Pocket', 'Quill', 'Dusk', 'Nutmeg', 'Wisp', 'Button'],
  },
};

export const CLASS_IDS = Object.keys(CLASSES);

// ---------- Materials ----------
// Three families of ten tiers. Workshops smelt scrap into one of these; the
// tier you get is rolled from the value of the scrap you put in.
// `palette` is [dark, mid, light], used to tint the material's icon.
const m = (id, name, blurb, palette) => ({ id, name, blurb, palette });
export const FAMILIES = {
  metal: {
    id: 'metal', name: 'Metals', base: 'metal',
    list: [
      m('iron', 'Iron', 'Common, dependable metal. The foundation of basic equipment.', ['#3d4249', '#7b828c', '#c3c9d1']),
      m('copper', 'Copper', 'Soft reddish metal used for early enchantments and conductive equipment.', ['#5a2a17', '#b8643a', '#f0a46e']),
      m('bronze', 'Bronze', 'An ancient alloy prized for its durability and craftsmanship.', ['#4f3716', '#a8792f', '#e5c070']),
      m('steel', 'Steel', 'Strong, refined metal used for advanced weapons and armor.', ['#2c3640', '#7f95a8', '#d6e2ec']),
      m('silversteel', 'Silversteel', 'Pale, shimmering metal with natural resistance to magic.', ['#55606b', '#b9c4cf', '#f4f8fb']),
      m('mithril', 'Mithril', 'Lightweight, exceptionally strong metal with a faint blue sheen.', ['#1f3a5c', '#5d95c9', '#bfe3ff']),
      m('stariron', 'Stariron', 'Metal forged from fallen stars, carrying celestial energy.', ['#20204a', '#5a5fb0', '#f2e48a']),
      m('bloodsteel', 'Bloodsteel', 'Deep crimson metal that grows stronger when exposed to battle.', ['#3d0b12', '#9c2333', '#e8707a']),
      m('voidforged', 'Voidforged', 'Dark metal infused with the essence of the void.', ['#120a1e', '#3d2a5c', '#8b6cc4']),
      m('godsbane', 'Godsbane', 'Legendary divine metal capable of harming otherwise invulnerable beings.', ['#5a4210', '#e0b43a', '#fff3b8']),
    ],
  },
  wood: {
    id: 'wood', name: 'Woods', base: 'wood',
    list: [
      m('pine', 'Pine', 'Common softwood used for basic tools, handles, and structures.', ['#5c3b1e', '#b07a43', '#e3b77a']),
      m('oak', 'Oak', 'Dense, sturdy timber ideal for shields and dependable equipment.', ['#3e2712', '#7d5128', '#b88552']),
      m('ashwood', 'Ashwood', 'Flexible and resilient wood favored for bows and staves.', ['#6b6150', '#b9ad92', '#e8dfc8']),
      m('ironwood', 'Ironwood', 'Exceptionally dense wood with the toughness of ordinary metal.', ['#2a2a2e', '#56585e', '#8e9098']),
      m('heartwood', 'Heartwood', 'Ancient timber harvested from the heart of old-growth forests.', ['#4a1a10', '#9a3f22', '#d77b4c']),
      m('thornwood', 'Thornwood', 'Aggressive, twisted timber that naturally grows sharp thorns.', ['#1f2a14', '#4a5c2a', '#8fa055']),
      m('moonwood', 'Moonwood', 'Pale silver wood that glows faintly under moonlight.', ['#5a6478', '#b8c3d6', '#f1f5ff']),
      m('elderwood', 'Elderwood', 'Magically saturated wood from trees hundreds of years old.', ['#2c1d3a', '#6a4a7d', '#b58fc4']),
      m('worldroot', 'Worldroot', "Wood from the colossal roots connecting the world's oldest forests.", ['#2b2014', '#6b5a3a', '#a8c070']),
      m('godwood', 'Godwood', 'Divine timber said to originate from the first tree in existence.', ['#6b4a12', '#e6c25a', '#fff6cf']),
    ],
  },
  crystal: {
    id: 'crystal', name: 'Crystals', base: 'gem',
    list: [
      m('quartz', 'Quartz', 'Common translucent crystal used in basic magical components.', ['#8b95a0', '#d4dde6', '#ffffff']),
      m('amethyst', 'Amethyst', 'Purple gemstone associated with focus, wisdom, and magical energy.', ['#3e1d63', '#8b52c9', '#d6b3ff']),
      m('garnet', 'Garnet', 'Deep red crystal that stores heat and physical energy.', ['#4a0a14', '#a8202f', '#f0707a']),
      m('moonstone', 'Moonstone', 'Iridescent gemstone that channels lunar magic.', ['#4d5d78', '#a9bdd9', '#f4f0ff']),
      m('sunstone', 'Sunstone', 'Golden crystal that absorbs and releases radiant energy.', ['#7a3d08', '#e8952a', '#ffe08a']),
      m('stormglass', 'Stormglass', 'Blue crystalline material that captures lightning and wind.', ['#0f3a5c', '#2f8fd0', '#a8e6ff']),
      m('soulstone', 'Soulstone', 'Rare crystal capable of holding fragments of living essence.', ['#0d3b33', '#2fae8f', '#a8ffe6']),
      m('dreamglass', 'Dreamglass', 'Shimmering crystal that bends reality and distorts perception.', ['#5a2a6b', '#e080c8', '#ffe0fa']),
      m('astralite', 'Astralite', 'Celestial crystal formed from condensed starlight.', ['#1b1b4a', '#5b6be0', '#fff6b0']),
      m('prismheart', 'Prismheart', 'Legendary crystal containing the concentrated essence of creation itself.', ['#a02a5a', '#f0a030', '#a0f0ff']),
    ],
  },
};

// Weapon power by material tier (1-10).
export const TIER_POWER = [1, 2, 3, 5, 7, 9, 12, 15, 19, 24];
export const TIER_NAMES = ['Common', 'Uncommon', 'Uncommon', 'Rare', 'Rare', 'Epic', 'Epic', 'Legendary', 'Legendary', 'Mythic'];

export const MATERIALS = {};
for (const fam of Object.values(FAMILIES)) {
  fam.list.forEach((mat, i) => {
    MATERIALS[mat.id] = { ...mat, family: fam.id, tier: i + 1, power: TIER_POWER[i] };
  });
}
export const materialAt = (family, tier) => FAMILIES[family].list[tier - 1].id;

// ---------- Scrap ----------
// What expeditions bring home. `value` is how much each piece adds to a
// smelting batch; `maxTier` is the best material that scrap can ever become.
export const SCRAPS = {
  twig:      { id: 'twig',      name: 'Stray Twig', family: 'wood',    value: 1, maxTier: 4, icon: 'assets/items/twig.png' },
  bottlecap: { id: 'bottlecap', name: 'Bottle Cap', family: 'metal',   value: 1, maxTier: 4, icon: 'assets/items/bottlecap.png' },
  pebble:    { id: 'pebble',    name: 'Pebble',     family: 'crystal', value: 1, maxTier: 4, icon: 'assets/items/pebble.png' },
};

// Every inventory item, for names and icons.
export const ITEMS = {};
for (const sc of Object.values(SCRAPS)) ITEMS[sc.id] = { ...sc, kind: 'scrap' };
for (const mat of Object.values(MATERIALS)) ITEMS[mat.id] = { ...mat, kind: 'material', icon: `assets/items/materials/${mat.id}.png` };

// ---------- Smelting odds ----------
// The total value of a batch sets how widely the odds spread across tiers.
// Tier 1 is always the likeliest; more value makes higher tiers likelier.
// Weight of tier t (1-based) is exp(-(t-1)^2 / (2 * spread^2)) with
// spread = sqrt(totalValue) / SMELT_FALLOFF. At 3 value that gives about
// 50% tier 1, 35% tier 2, 12% tier 3 and 2% tier 4.
export const SMELT_FALLOFF = 1.46;
export const MAX_BATCH = 3; // pieces per batch

// ---------- Weapons ----------
// Each class has two weapon types. A weapon is one type made from one
// material of that type's family (an Oak Longbow, a Steel Mace). Power comes
// from the material's tier for now. `stats` will hold each type's own stat
// distribution (coming soon).
export const WEAPON_COST = 3;
export const WEAPONS = {
  longbow: { id: 'longbow', name: 'Longbow',     cls: 'archer', family: 'wood',    icon: 'assets/items/bow.png',   stats: null },
  recurve: { id: 'recurve', name: 'Recurve Bow', cls: 'archer', family: 'wood',    icon: 'assets/items/bow.png',   stats: null },
  sword:   { id: 'sword',   name: 'Sword',       cls: 'knight', family: 'metal',   icon: 'assets/items/sword.png', stats: null },
  mace:    { id: 'mace',    name: 'Mace',        cls: 'knight', family: 'metal',   icon: 'assets/items/sword.png', stats: null },
  staff:   { id: 'staff',   name: 'Staff',       cls: 'mage',   family: 'crystal', icon: 'assets/items/staff.png', stats: null },
  tome:    { id: 'tome',    name: 'Tome',        cls: 'mage',   family: 'crystal', icon: 'assets/items/staff.png', stats: null },
};
export const weaponsFor = (cls) => Object.values(WEAPONS).filter((w) => w.cls === cls);

// Each workshop smelts one kind of scrap into its family's materials.
export const WORKSHOPS = {
  woodworker: {
    id: 'woodworker', name: "Woodworker's Cabin", input: 'twig', family: 'wood', cls: 'archer', minutes: 5,
    blurb: 'Twigs are whittled, bound and seasoned into timber.',
  },
  forge: {
    id: 'forge', name: 'The Forge', input: 'bottlecap', family: 'metal', cls: 'knight', minutes: 5,
    blurb: 'Bottle caps are melted down and hammered into metal.',
  },
  enchanter: {
    id: 'enchanter', name: "Enchanter's Hut", input: 'pebble', family: 'crystal', cls: 'mage', minutes: 5,
    blurb: 'Ordinary pebbles are coaxed into crystals.',
  },
};

// Expeditions. Each encounter in a run is drawn from `encounters`.
// `demand` is the class that shines in that encounter; matching creatures
// count for more. `loot` weights decide which scrap is found.
export const EXPEDITIONS = {
  thicket: {
    id: 'thicket',
    name: 'Tangled Thicket',
    blurb: 'Brambles and fallen branches. Long sightlines reward archers.',
    baseDifficulty: 6,
    loot: { twig: 6, bottlecap: 1, pebble: 1 },
    encounters: [
      { name: 'Bramble maze',          demand: 'archer' },
      { name: 'Ambush of hornets',     demand: 'archer' },
      { name: 'Grumpy hedgehog',       demand: 'knight' },
      { name: 'Fallen log crossing',   demand: 'archer' },
      { name: 'Whispering mushrooms',  demand: 'mage' },
    ],
  },
  gutter: {
    id: 'gutter',
    name: 'Old Gutter Drain',
    blurb: 'Rusty, cramped and full of trash. Armour is a must.',
    baseDifficulty: 7,
    loot: { bottlecap: 6, twig: 1, pebble: 1 },
    encounters: [
      { name: 'Rat patrol',            demand: 'knight' },
      { name: 'Rushing water',         demand: 'knight' },
      { name: 'Jammed grate',          demand: 'knight' },
      { name: 'Spider nest',           demand: 'archer' },
      { name: 'Glowing puddle',        demand: 'mage' },
    ],
  },
  creek: {
    id: 'creek',
    name: 'Glimmer Creek',
    blurb: 'Smooth stones and odd lights. Magic folk feel at home.',
    baseDifficulty: 6,
    loot: { pebble: 6, twig: 1, bottlecap: 1 },
    encounters: [
      { name: 'Will-o-wisps',          demand: 'mage' },
      { name: 'Riddling frog',         demand: 'mage' },
      { name: 'Slippery stones',       demand: 'mage' },
      { name: 'Snapping crayfish',     demand: 'knight' },
      { name: 'Heron overhead',        demand: 'archer' },
    ],
  },
  meadow: {
    id: 'meadow',
    name: 'Windy Meadow',
    blurb: 'A bit of everything. Bring a mixed party.',
    baseDifficulty: 8,
    loot: { twig: 3, bottlecap: 3, pebble: 3 },
    encounters: [
      { name: 'Dandelion storm',       demand: 'mage' },
      { name: 'Stampeding ants',       demand: 'knight' },
      { name: 'Crow on the hunt',      demand: 'archer' },
      { name: 'Lost picnic basket',    demand: 'knight' },
      { name: 'Fairy ring',            demand: 'mage' },
      { name: 'Grasshopper duel',      demand: 'archer' },
    ],
  },
};

export const EXPEDITION_IDS = Object.keys(EXPEDITIONS);

// Luring new recruits: leave a crafted weapon at the Lure Post and a new
// creature of that weapon's class comes to claim it.
export const LURE_MINUTES = 30;
export const MAX_ROSTER = 24;
