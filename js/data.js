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
    weapon: 'bow',
    material: 'wood',
    blurb: 'Sharp-eyed and patient. Picks off threats from the tall grass.',
    names: ['Fern', 'Sizzle', 'Ember', 'Basil', 'Copper', 'Rusk', 'Tango', 'Sorrel', 'Pip', 'Cinder', 'Mango', 'Saffron'],
  },
  knight: {
    id: 'knight',
    name: 'Beetle Knight',
    plural: 'Beetle Knights',
    sprite: 'assets/sprites/beetle-knight.png',
    weapon: 'sword',
    material: 'metal',
    blurb: 'Armoured and stubborn. Charges head-first into anything.',
    names: ['Sir Clover', 'Dame Moss', 'Sir Bramble', 'Dame Ivy', 'Sir Thistle', 'Dame Sage', 'Sir Burdock', 'Dame Juniper', 'Sir Oakley', 'Dame Briar'],
  },
  mage: {
    id: 'mage',
    name: 'Wizard Mouse',
    plural: 'Wizard Mice',
    sprite: 'assets/sprites/wizard-mouse.png',
    weapon: 'staff',
    material: 'gem',
    blurb: 'Small, clever, and full of strange sparks.',
    names: ['Whisker', 'Nib', 'Mumble', 'Thimble', 'Crumb', 'Pocket', 'Quill', 'Dusk', 'Nutmeg', 'Wisp', 'Button'],
  },
};

export const CLASS_IDS = Object.keys(CLASSES);

// Raw scavenged items, processed materials and weapons.
export const ITEMS = {
  twig:      { id: 'twig',      name: 'Stray Twig',  kind: 'scrap',    icon: 'assets/items/twig.png' },
  bottlecap: { id: 'bottlecap', name: 'Bottle Cap',  kind: 'scrap',    icon: 'assets/items/bottlecap.png' },
  pebble:    { id: 'pebble',    name: 'Pebble',      kind: 'scrap',    icon: 'assets/items/pebble.png' },
  wood:      { id: 'wood',      name: 'Wood Plank',  kind: 'material', icon: 'assets/items/wood.png' },
  metal:     { id: 'metal',     name: 'Metal Scrap', kind: 'material', icon: 'assets/items/metal.png' },
  gem:       { id: 'gem',       name: 'Gemstone',    kind: 'material', icon: 'assets/items/gem.png' },
};

// Weapons are crafted per tier. Each class has one weapon line.
export const WEAPON_TIERS = [
  { tier: 1, prefix: 'Rough',   power: 2, cost: 2 },
  { tier: 2, prefix: 'Sturdy',  power: 4, cost: 4 },
  { tier: 3, prefix: 'Fine',    power: 7, cost: 7 },
];

export const WEAPONS = {
  bow:   { id: 'bow',   name: 'Bow',   cls: 'archer', material: 'wood',  icon: 'assets/items/bow.png' },
  sword: { id: 'sword', name: 'Sword', cls: 'knight', material: 'metal', icon: 'assets/items/sword.png' },
  staff: { id: 'staff', name: 'Staff', cls: 'mage',   material: 'gem',   icon: 'assets/items/staff.png' },
};

// Each workshop turns one kind of scrap into one material, over time.
export const WORKSHOPS = {
  woodworker: {
    id: 'woodworker',
    name: "Woodworker's Cabin",
    input: 'twig', inputQty: 4,
    output: 'wood', outputQty: 1,
    minutes: 5,
    weapon: 'bow',
    blurb: 'Twigs are whittled, bound and glued into usable planks.',
  },
  forge: {
    id: 'forge',
    name: 'The Forge',
    input: 'bottlecap', inputQty: 4,
    output: 'metal', outputQty: 1,
    minutes: 5,
    weapon: 'sword',
    blurb: 'Bottle caps are hammered flat and folded into metal.',
  },
  enchanter: {
    id: 'enchanter',
    name: "Enchanter's Hut",
    input: 'pebble', inputQty: 4,
    output: 'gem', outputQty: 1,
    minutes: 5,
    weapon: 'staff',
    blurb: 'Ordinary pebbles are coaxed into glittering gemstones.',
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
