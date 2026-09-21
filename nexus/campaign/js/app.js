import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, addDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

// --- FIREBASE INITIALIZATION & TOP-LEVEL STATE SCOPING ---
const firebaseConfig = {
    apiKey: "AIzaSyCKRN5dfi4og69_D8ZAvV1BQfwCK_f2uis",
    authDomain: "dndcampaigns-f3d48.firebaseapp.com",
    projectId: "dndcampaigns-f3d48",
    storageBucket: "dndcampaigns-f3d48.firebasestorage.app",
    messagingSenderId: "1074491536795",
    appId: "1:1074491536795:web:56211729489be776d79d3e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Top-level Application State
let characters = [], parties = [], currentUser = null, activeCharId = null, activeRole = 'player', rollMode = 'normal';
let autoSaveTimer = null, lastGeneratedScores = [], sessionRerollUsed = false;
let activeManagePartyId = null, activeMoveLvl = null, editingMoveIndex = null;
let campaignSettings = { terms: {} };

// --- AEONFALL DATA-DRIVEN VOCATIONS DATA ENGINE ---
const VOCATION_CONFIG = {
    'heartbound': {
        name: 'Heartbound', baseClass: 'Paladin', hitDie: 10, primaryAbilities: 'Strength / Charisma', multiclassReq: 'Strength 13 or Charisma 13',
        trackers: ['Script Slots', 'Concords', 'Heart Resonance Tracker', 'Heart Strain Tracker'],
        features: ['Scriptcasting', 'Scriptcasting Focus', 'Component Satchel', 'Known Scripts', 'Core-Touched Effects'],
        equip: ['Heart Focus', 'Component Materials'],
        progression: {
            1: ['Heartbound features'], 2: ['Fighting Style', 'Scriptcasting', 'Heartbound feature'], 3: ['Heartbound Path'], 4: ['ASI / Feat'], 5: ['Extra Attack'],
            6: ['Protective feature'], 7: ['Path feature'], 8: ['ASI / Feat'], 9: ['Higher-tier progression'], 10: ['Aura/defensive feature'], 11: ['Damage enhancement'],
            12: ['ASI / Feat'], 13: ['Higher-tier progression'], 14: ['Cleansing/restoration feature'], 15: ['Path feature'], 16: ['ASI / Feat'], 17: ['Higher-tier progression'],
            18: ['Improved aura'], 19: ['ASI / Feat'], 20: ['Heartbound capstone']
        }
    },
    'nomad': {
        name: 'Nomad', baseClass: 'Ranger', hitDie: 10, primaryAbilities: 'Dexterity / Wisdom', multiclassReq: 'Dexterity 13 or Wisdom 13',
        trackers: ['Survival Resources', 'Companion Tracker'],
        features: ['Travel Features', 'Route Knowledge', 'Vehicle/Transport Features', 'Exploration Benefits'],
        equip: ['Travel Gear', 'Navigation Tools', 'Survival Supplies'],
        progression: {
            1: ['Favored Enemy / Exploration features'], 2: ['Fighting Style', 'Scriptcasting'], 3: ['Nomad Path'], 4: ['ASI / Feat'], 5: ['Extra Attack'],
            6: ['Exploration feature'], 7: ['Path feature'], 8: ['ASI / Feat'], 9: ['Higher-tier progression'], 10: ['Wilderness feature'], 11: ['Path feature'],
            12: ['ASI / Feat'], 13: ['Higher-tier progression'], 14: ['Exploration feature'], 15: ['Path feature'], 16: ['ASI / Feat'], 17: ['Higher-tier progression'],
            18: ['Senses / tracking feature'], 19: ['ASI / Feat'], 20: ['Nomad capstone']
        }
    },
    'warden': {
        name: 'Wilderness Warden', baseClass: 'Druid', hitDie: 8, primaryAbilities: 'Wisdom', multiclassReq: 'Wisdom 13',
        trackers: ['Companion Tracker'],
        features: ['Nature Features', 'Tracking Abilities', 'Survival Techniques'],
        equip: ['Warden Tools', 'Hunting Gear'],
        progression: {
            1: ['Warden features', 'Scriptcasting'], 2: ['Wilderness Warden Circle'], 3: ['Higher Script access'], 4: ['ASI / Feat'], 5: ['Higher-tier Scripts'],
            6: ['Circle feature'], 7: ['Higher-tier Scripts'], 8: ['ASI / Feat'], 9: ['Higher-tier Scripts'], 10: ['Circle feature'], 11: ['Higher-tier Scripts'],
            12: ['ASI / Feat'], 13: ['Higher-tier Scripts'], 14: ['Circle feature'], 15: ['Higher-tier Scripts'], 16: ['ASI / Feat'], 17: ['Higher-tier Scripts'],
            18: ['Warden feature'], 19: ['ASI / Feat'], 20: ['Warden capstone']
        }
    },
    'chronicler': {
        name: 'Chronicler', baseClass: 'Cleric', hitDie: 8, primaryAbilities: 'Wisdom', multiclassReq: 'Wisdom 13',
        trackers: ['Inspiration Tracker'],
        features: ['Recorded Knowledge', 'Lore Archive', 'Story/Memory Features'],
        equip: ['Journal', 'Recording Tools'],
        progression: {
            1: ['Chronicler features', 'Scriptcasting'], 2: ['Chronicler feature'], 3: ['Chronicler Path'], 4: ['ASI / Feat'], 5: ['Higher-tier Scripts'],
            6: ['Path feature'], 7: ['Higher-tier Scripts'], 8: ['ASI / Feat'], 9: ['Higher-tier Scripts'], 10: ['Chronicler feature'], 11: ['Higher-tier Scripts'],
            12: ['ASI / Feat'], 13: ['Higher-tier Scripts'], 14: ['Path feature'], 15: ['Higher-tier Scripts'], 16: ['ASI / Feat'], 17: ['Higher-tier Scripts'],
            18: ['Chronicler feature'], 19: ['ASI / Feat'], 20: ['Chronicler capstone']
        }
    },
    'orator': {
        name: 'Orator', baseClass: 'Bard', hitDie: 8, primaryAbilities: 'Charisma', multiclassReq: 'Charisma 13',
        trackers: ['Script Slots', 'Concords', 'Inspiration Pool', 'Influence Tracker'],
        features: ['Scriptcasting', 'Scriptcasting Focus', 'Social Abilities'],
        equip: ['Focus Item', 'Performance Tools'],
        progression: {
            1: ['Inspiration', 'Scriptcasting'], 2: ['Orator feature'], 3: ['Orator Path'], 4: ['ASI / Feat'], 5: ['Inspiration improvement'],
            6: ['Path feature'], 7: ['Higher-tier Scripts'], 8: ['ASI / Feat'], 9: ['Expertise / Script progression'], 10: ['Inspiration improvement'],
            11: ['Higher-tier Scripts'], 12: ['ASI / Feat'], 13: ['Higher-tier Scripts'], 14: ['Path feature'], 15: ['Inspiration improvement'],
            16: ['ASI / Feat'], 17: ['Higher-tier Scripts'], 18: ['Inspiration improvement'], 19: ['ASI / Feat'], 20: ['Orator capstone']
        }
    },
    'scriptweaver': {
        name: 'Scriptweaver', baseClass: 'Sorcerer', hitDie: 6, primaryAbilities: 'Charisma', multiclassReq: 'Charisma 13',
        trackers: ['Script Slots', 'Concords'],
        features: ['Scriptcasting', 'Scriptcasting Focus', 'Prepared Scripts', 'Script Modifiers'],
        equip: ['Script Focus', 'Script Archive'],
        progression: {
            1: ['Scriptcasting', 'Scriptweaver Origin'], 2: ['Script Points / equivalent feature'], 3: ['Origin feature'], 4: ['ASI / Feat'], 5: ['Higher-tier Scripts'],
            6: ['Origin feature'], 7: ['Higher-tier Scripts'], 8: ['ASI / Feat'], 9: ['Higher-tier Scripts'], 10: ['Script modification feature'],
            11: ['Higher-tier Scripts'], 12: ['ASI / Feat'], 13: ['Higher-tier Scripts'], 14: ['Origin feature'], 15: ['Higher-tier Scripts'],
            16: ['ASI / Feat'], 17: ['Higher-tier Scripts'], 18: ['Script modification feature'], 19: ['ASI / Feat'], 20: ['Scriptweaver capstone']
        }
    },
    'wartouched': {
        name: 'War-Touched', baseClass: 'Warlock', hitDie: 8, primaryAbilities: 'Charisma', multiclassReq: 'Charisma 13',
        trackers: ['Core Energy Tracker', 'Mutation Tracker', 'Instability Tracker'],
        features: ['Transformation Abilities', 'Enhanced Physiology Features'],
        equip: ['Core Relic', 'Mutation Records'],
        progression: {
            1: ['Patron/Source', 'Scriptcasting'], 2: ['Invocation-style features'], 3: ['War-Touched Path'], 4: ['ASI / Feat'], 5: ['Higher-tier Scripts'],
            6: ['Path feature'], 7: ['Higher-tier Scripts'], 8: ['ASI / Feat'], 9: ['Higher-tier Scripts'], 10: ['Path feature'], 11: ['Higher-tier Scripts'],
            12: ['ASI / Feat'], 13: ['Higher-tier Scripts'], 14: ['Path feature'], 15: ['Invocation feature'], 16: ['ASI / Feat'], 17: ['Higher-tier Scripts'],
            18: ['Invocation feature'], 19: ['ASI / Feat'], 20: ['War-Touched capstone']
        }
    },
    'archivist': {
        name: 'Archivist', baseClass: 'Wizard', hitDie: 6, primaryAbilities: 'Intelligence', multiclassReq: 'Intelligence 13',
        trackers: ['Script Slots', 'Concords'],
        features: ['Scriptcasting', 'Archive Codex', 'Research Database', 'Relic Records'],
        equip: ['Archive Tools', 'Data Storage'],
        progression: {
            1: ['Scriptcasting', 'Archive'], 2: ['Archive specialization'], 3: ['Archive feature'], 4: ['ASI / Feat'], 5: ['Higher-tier Scripts'],
            6: ['Archive feature'], 7: ['Higher-tier Scripts'], 8: ['ASI / Feat'], 9: ['Higher-tier Scripts'], 10: ['Archive feature'], 11: ['Higher-tier Scripts'],
            12: ['ASI / Feat'], 13: ['Higher-tier Scripts'], 14: ['Archive feature'], 15: ['Higher-tier Scripts'], 16: ['ASI / Feat'], 17: ['Higher-tier Scripts'],
            18: ['Archive feature'], 19: ['ASI / Feat'], 20: ['Archivist capstone']
        }
    },
    'fabricator': {
        name: 'Fabricator', baseClass: 'Artificer', hitDie: 8, primaryAbilities: 'Intelligence', multiclassReq: 'Intelligence 13',
        trackers: ['Script Slots', 'Concords', 'Construct Tracker', 'Active Creations'],
        features: ['Fabrication Toolkit', 'Schematics', 'Crafting Materials'],
        equip: ['Fabrication Tools', 'Workshop Supplies'],
        progression: {
            1: ['Fabricator features', 'Scriptcasting'], 2: ['Infusion/augmentation system'], 3: ['Fabricator specialization'], 4: ['ASI / Feat'], 5: ['Higher-tier Scripts'],
            6: ['Fabrication feature'], 7: ['Specialization feature'], 8: ['ASI / Feat'], 9: ['Higher-tier Scripts'], 10: ['Fabrication feature'], 11: ['Advanced fabrication'],
            12: ['ASI / Feat'], 13: ['Higher-tier Scripts'], 14: ['Specialization feature'], 15: ['Fabrication feature'], 16: ['ASI / Feat'], 17: ['Higher-tier Scripts'],
            18: ['Fabrication feature'], 19: ['ASI / Feat'], 20: ['Fabricator capstone']
        }
    },
    'peacekeeper': {
        name: 'Peacekeeper', baseClass: 'Monk', hitDie: 8, primaryAbilities: 'Dexterity / Wisdom', multiclassReq: 'Dexterity 13 and Wisdom 13',
        trackers: ['Marked Targets Tracker'],
        features: ['Authority Features', 'Command Abilities', 'Tactical Orders'],
        equip: ['Badge/Emblem', 'Restraint Tools'],
        progression: {
            1: ['Martial Arts', 'Peacekeeper features'], 2: ['Ki-equivalent resource'], 3: ['Peacekeeper Discipline'], 4: ['ASI / Feat'], 5: ['Extra Attack'],
            6: ['Discipline feature'], 7: ['Defensive feature'], 8: ['ASI / Feat'], 9: ['Movement improvement'], 10: ['Defensive feature'], 11: ['Discipline feature'],
            12: ['ASI / Feat'], 13: ['Communication/sensory feature'], 14: ['Defensive feature'], 15: ['Advanced Peacekeeper feature'], 16: ['ASI / Feat'],
            17: ['Discipline feature'], 18: ['Advanced defensive feature'], 19: ['ASI / Feat'], 20: ['Peacekeeper capstone']
        }
    },
    'warrior': {
        name: 'Warrior', baseClass: 'Fighter', hitDie: 10, primaryAbilities: 'Strength / Dexterity', multiclassReq: 'Strength 13 or Dexterity 13',
        trackers: ['Battle Surge Tracker'],
        features: ['Combat Techniques', 'Weapon Specializations', 'Fighting Style'],
        equip: ['Weapon Loadout', 'Ammunition'],
        progression: {
            1: ['Fighting Style', 'Second Wind'], 2: ['Action Surge'], 3: ['Warrior Archetype'], 4: ['ASI / Feat'], 5: ['Extra Attack'], 6: ['ASI / Feat'],
            7: ['Archetype feature'], 8: ['ASI / Feat'], 9: ['Indomitable'], 10: ['Archetype feature'], 11: ['Extra Attack improvement'], 12: ['ASI / Feat'],
            13: ['Indomitable improvement'], 14: ['ASI / Feat'], 15: ['Archetype feature'], 16: ['ASI / Feat'], 17: ['Action Surge / Indomitable improvement'],
            18: ['Archetype feature'], 19: ['ASI / Feat'], 20: ['Extra Attack improvement']
        }
    },
    'vanguard': {
        name: 'Vanguard', baseClass: 'Barbarian', hitDie: 12, primaryAbilities: 'Strength', multiclassReq: 'Strength 13',
        trackers: ['Guard Stance Tracker'],
        features: ['Vanguard Features', 'Defensive Techniques', 'Challenge Targets'],
        equip: ['Primary Weapon', 'Shield/Defensive Gear'],
        progression: {
            1: ['Rage', 'Unarmored Defense'], 2: ['Reckless Attack', 'Danger Sense'], 3: ['Vanguard Path'], 4: ['ASI / Feat'], 5: ['Extra Attack', 'movement improvement'],
            6: ['Path feature'], 7: ['Feral Instinct'], 8: ['ASI / Feat'], 9: ['Brutal Critical'], 10: ['Path feature'], 11: ['Relentless feature'],
            12: ['ASI / Feat'], 13: ['Brutal Critical'], 14: ['Path feature'], 15: ['Rage improvement'], 16: ['ASI / Feat'], 17: ['Brutal Critical'],
            18: ['Persistent Rage'], 19: ['ASI / Feat'], 20: ['Primal Champion']
        }
    },
    'scavenger': {
        name: 'Scavenger', baseClass: 'Rogue', hitDie: 8, primaryAbilities: 'Dexterity', multiclassReq: 'Dexterity 13',
        trackers: ['Salvage Cache', 'Salvage Materials'],
        features: ['Improvised Equipment', 'Relic Finds', 'Scrap Collection'],
        equip: ['Scavenging Tools', 'Salvage Kit'],
        progression: {
            1: ['Expertise', 'Sneak Attack'], 2: ['Cunning Action'], 3: ['Scavenger Archetype'], 4: ['ASI / Feat'], 5: ['Uncanny Dodge'], 6: ['Expertise'],
            7: ['Evasion'], 8: ['ASI / Feat'], 9: ['Archetype feature'], 10: ['ASI / Feat'], 11: ['Reliable Talent'], 12: ['ASI / Feat'],
            13: ['Archetype feature'], 14: ['Blindsense'], 15: ['Slippery Mind'], 16: ['ASI / Feat'], 17: ['Archetype feature'], 18: ['Elusive'],
            19: ['ASI / Feat'], 20: ['Stroke of Luck']
        }
    }
};

const DEFAULT_MODULES = {
    mod_skills: true, mod_saves: true, mod_insp: true, mod_death: true,
    mod_stress: true, mod_conditions: true, mod_defenses: true,
    mod_currency: true, mod_inventory: true, mod_background: true, mod_companion: true
};

const SHEET_LABELS = {
    class: "Class", level: "Level", party: "Party", race: "Race", archetype: "Archetype", belief: "Belief",
    insp: "Inspiration", abilities: "Abilities", prof: "Proficiency", saves: "Saves", skills: "Skills",
    ac: "AC", init: "INIT", speed: "Speed", hp: "Health Points", hd: "Hit Dice", temphp: "Temp HP",
    death: "Death & Coma", stress: "Stress", trauma: "Trauma", actions: "Actions", attacks: "Attacks",
    defenses: "Defenses", conditions: "Conditions", proficiencies: "Proficiencies", inventory: "Inventory",
    currency: "Currency", equipment: "Equipment", traits: "Traits", personality: "Personality",
    ideals: "Ideals", bonds: "Bonds", flaws: "Flaws", background: "Background", characteristics: "Characteristics",
    companion: "Companion", notes: "Notes", scripts: "Scripts", scriptcasting: "Scriptcasting", tricks: "Tricks"
};

const STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const SKILLS = [
    {n: 'Acrobatics', s: 'dex'}, {n: 'Animal Handling', s: 'wis'}, {n: 'Arcana', s: 'int'},
    {n: 'Athletics', s: 'str'}, {n: 'Deception', s: 'cha'}, {n: 'History', s: 'int'},
    {n: 'Insight', s: 'wis'}, {n: 'Intimidation', s: 'cha'}, {n: 'Investigation', s: 'int'},
    {n: 'Medicine', s: 'wis'}, {n: 'Nature', s: 'int'}, {n: 'Perception', s: 'wis'},
    {n: 'Performance', s: 'cha'}, {n: 'Persuasion', s: 'cha'}, {n: 'Religion', s: 'int'},
    {n: 'Sleight of Hand', s: 'dex'}, {n: 'Stealth', s: 'dex'}, {n: 'Survival', s: 'wis'}
];

window.getVocationKey = (nameStr) => {
    if (!nameStr) return 'warrior';
    const c = nameStr.toLowerCase();
    for (const key in VOCATION_CONFIG) {
        if (c.includes(key) || c.includes(VOCATION_CONFIG[key].name.toLowerCase())) return key;
    }
    return 'warrior';
};

window.getProficiencyBonus = (charLvl) => {
    const l = parseInt(charLvl) || 1;
    return l >= 17 ? 6 : l >= 13 ? 5 : l >= 9 ? 4 : l >= 5 ? 3 : 2;
};

window.openSettingsModal = () => {
    const t = campaignSettings.terms || {};
    const mods = campaignSettings.modules || DEFAULT_MODULES;

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

    setVal('term-nav_party', t.nav_party || 'Party');
    setVal('term-nav_npcs', t.nav_npcs || 'NPCs');
    setVal('term-nav_beasts', t.nav_beasts || 'Bestiary');
    setVal('term-nav_backpack', t.nav_backpack || 'Backpack');
    setVal('term-nav_handbook', t.nav_handbook || 'Handbook');
    setVal('term-nav_graveyard', t.nav_graveyard || 'Graveyard');
    setVal('term-nav_logs', t.nav_logs || 'Logs');

    setVal('term-book_vocations', t.book_vocations || 'Vocations');
    setVal('term-book_lineages', t.book_lineages || 'Lineages');
    setVal('term-book_backgrounds', t.book_backgrounds || 'Backgrounds');
    setVal('term-book_landmarks', t.book_landmarks || 'Landmarks');
    setVal('term-book_scriptcodex', t.book_scriptcodex || 'Script Codex');
    setVal('term-book_artifacts', t.book_artifacts || 'Gear & Artifacts');
    setVal('term-book_worldlore', t.book_worldlore || 'World Lore');
    setVal('term-lore_custodians', t.lore_custodians || "Custodian's Athenaeum");
    setVal('term-lore_archivists', t.lore_archivists || "Archivist Public Library");

    setVal('term-class_vanguard', t.class_vanguard || 'Vanguard');
    setVal('term-class_warrior', t.class_warrior || 'Warrior');
    setVal('term-class_peacekeeper', t.class_peacekeeper || 'Peacekeeper');
    setVal('term-class_scavenger', t.class_scavenger || 'Scavenger');
    setVal('term-class_heartbound', t.class_heartbound || 'Heartbound');
    setVal('term-class_nomad', t.class_nomad || 'Nomad');
    setVal('term-class_warden', t.class_warden || 'Wilderness Warden');
    setVal('term-class_chronicler', t.class_chronicler || 'Chronicler');
    setVal('term-class_orator', t.class_orator || 'Orator');
    setVal('term-class_scriptweaver', t.class_scriptweaver || 'Scriptweaver');
    setVal('term-class_wartouched', t.class_wartouched || 'War-Touched');
    setVal('term-class_archivist', t.class_archivist || 'Archivist');
    setVal('term-class_fabricator', t.class_fabricator || 'Fabricator');

    Object.keys(SHEET_LABELS).forEach(k => {
        const el = document.getElementById(`term-sheet_${k}`);
        if(el) el.value = t[`sheet_${k}`] || SHEET_LABELS[k];
    });

    Object.keys(DEFAULT_MODULES).forEach(k => {
        const el = document.getElementById(k);
        if (el) el.checked = mods[k] !== false;
    });

    document.getElementById('settings-modal').classList.remove('hidden');
};

window.saveTerminology = async () => {
    const getVal = (id, fallback) => document.getElementById(id)?.value?.trim() || fallback;

    const terms = {
        nav_party: getVal('term-nav_party', 'Party'),
        nav_npcs: getVal('term-nav_npcs', 'NPCs'),
        nav_beasts: getVal('term-nav_beasts', 'Bestiary'),
        nav_backpack: getVal('term-nav_backpack', 'Backpack'),
        nav_handbook: getVal('term-nav_handbook', 'Handbook'),
        nav_graveyard: getVal('term-nav_graveyard', 'Graveyard'),
        nav_logs: getVal('term-nav_logs', 'Logs'),

        book_vocations: getVal('term-book_vocations', 'Vocations'),
        book_lineages: getVal('term-book_lineages', 'Lineages'),
        book_backgrounds: getVal('term-book_backgrounds', 'Backgrounds'),
        book_landmarks: getVal('term-book_landmarks', 'Landmarks'),
        book_scriptcodex: getVal('term-book_scriptcodex', 'Script Codex'),
        book_artifacts: getVal('term-book_artifacts', 'Gear & Artifacts'),
        book_worldlore: getVal('term-book_worldlore', 'World Lore'),
        lore_custodians: getVal('term-lore_custodians', "Custodian's Athenaeum"),
        lore_archivists: getVal('term-lore_archivists', "Archivist Public Library"),

        class_vanguard: getVal('term-class_vanguard', 'Vanguard'),
        class_warrior: getVal('term-class_warrior', 'Warrior'),
        class_peacekeeper: getVal('term-class_peacekeeper', 'Peacekeeper'),
        class_scavenger: getVal('term-class_scavenger', 'Scavenger'),
        class_heartbound: getVal('term-class_heartbound', 'Heartbound'),
        class_nomad: getVal('term-class_nomad', 'Nomad'),
        class_warden: getVal('term-class_warden', 'Wilderness Warden'),
        class_chronicler: getVal('term-class_chronicler', 'Chronicler'),
        class_orator: getVal('term-class_orator', 'Orator'),
        class_scriptweaver: getVal('term-class_scriptweaver', 'Scriptweaver'),
        class_wartouched: getVal('term-class_wartouched', 'War-Touched'),
        class_archivist: getVal('term-class_archivist', 'Archivist'),
        class_fabricator: getVal('term-class_fabricator', 'Fabricator')
    };

    const modules = {};
    Object.keys(DEFAULT_MODULES).forEach(k => {
        const el = document.getElementById(k);
        if (el) modules[k] = el.checked;
    });

    Object.keys(SHEET_LABELS).forEach(k => {
        const el = document.getElementById(`term-sheet_${k}`);
        if(el) terms[`sheet_${k}`] = el.value.trim() || SHEET_LABELS[k];
    });

    try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'campaignConfig', 'settings'), { terms, modules }, { merge: true });
        document.getElementById('settings-modal').classList.add('hidden');
        window.showToast("Campaign Terminology Updated!");
    } catch (err) {
        console.error(err);
        window.showToast("Failed to save terminology");
    }
};

const applyCampaignSettings = (settings) => {
    if (!settings) return;
    const terms = settings.terms || {};
    const mods = settings.modules || DEFAULT_MODULES;

    const safeSet = (id, val) => { const el = document.getElementById(id); if (el && val) el.innerText = val; };
    
    safeSet('nav-party', terms.nav_party);
    
    Object.keys(SHEET_LABELS).forEach(k => {
        safeSet(`label-term-${k}`, terms[`sheet_${k}`] || SHEET_LABELS[k]);
    });
    
    safeSet('class-label', terms.sheet_class || SHEET_LABELS.class);
    safeSet('label-term-hd-inline', (terms.sheet_hd || SHEET_LABELS.hd) + ':');
    safeSet('label-term-stress-header', (terms.sheet_stress || SHEET_LABELS.stress) + ' & ' + (terms.sheet_trauma || SHEET_LABELS.trauma));
    safeSet('death-coma-header', terms.sheet_death || SHEET_LABELS.death);
    
    // Update Moves Selector options dynamically
    const movesSel = document.getElementById('moves-selector');
    if (movesSel) {
        if (movesSel.options[0]) movesSel.options[0].text = terms.sheet_actions || "Features";
        if (movesSel.options[1]) movesSel.options[1].text = terms.sheet_scripts || "Scripts";
    }

    const toggleEl = (id, show) => { const el = document.getElementById(id); if (el) el.style.display = show ? '' : 'none'; };
    toggleEl('sheet-card-skills', mods.mod_skills !== false);
    toggleEl('sheet-card-saves', mods.mod_saves !== false);
    toggleEl('vital-insp', mods.mod_insp !== false);
    toggleEl('sheet-card-death', mods.mod_death !== false);
    toggleEl('sheet-card-stress', mods.mod_stress !== false);
    toggleEl('section-conditions', mods.mod_conditions !== false);
    toggleEl('section-defenses', mods.mod_defenses !== false);
    toggleEl('section-currency', mods.mod_currency !== false);
    toggleEl('tab-btn-inventory', mods.mod_inventory !== false);
    toggleEl('tab-btn-background', mods.mod_background !== false);
    toggleEl('tab-btn-companion', mods.mod_companion !== false);
};

// --- SCRIPTCASTING GRID RENDERER WITH DYNAMIC TERMINOLOGY ---
window.renderMovesGrid = () => { 
    const s = document.getElementById('moves-selector'); if (!s) return; 
    const t = s.value, g = document.getElementById('features-lvl-grid'); if (!g) return; 
    g.innerHTML = '';
    
    const char = characters.find(c => c.id === activeCharId); 
    const moves = char?.moves || []; 
    let levels = [];

    const scriptTerm = campaignSettings?.terms?.sheet_scripts || "Scriptcasting";
    const tricksTerm = campaignSettings?.terms?.sheet_tricks || "Tricks (0)";

    const FULL_SCRIPTCASTERS = ['archivist', 'scriptweaver', 'wartouched', 'orator', 'warden', 'chronicler'];
    const HALF_SCRIPTCASTERS = ['heartbound', 'nomad', 'fabricator'];
    
    if (t === 'features') {
        levels = Array.from({length: 20}, (_, i) => `Level ${i + 1}`);
    } else {
        let classes = char?.classes || [];
        if (classes.length === 0 && char?.class) {
            classes = [{ name: char.class }];
        }

        let maxScriptLevel = -1;
        let includesTricks = false;

        classes.forEach(clsObj => {
            const vKey = window.getVocationKey(clsObj.name);

            if (FULL_SCRIPTCASTERS.includes(vKey)) {
                maxScriptLevel = Math.max(maxScriptLevel, 9);
                includesTricks = true;
            } else if (HALF_SCRIPTCASTERS.includes(vKey)) {
                maxScriptLevel = Math.max(maxScriptLevel, 5);
                if (vKey === 'fabricator') includesTricks = true;
            } else if (vKey === 'warrior' || vKey === 'scavenger') {
                maxScriptLevel = Math.max(maxScriptLevel, 4);
                includesTricks = true;
            }
        });

        if (maxScriptLevel === -1) {
            g.innerHTML = `
                <div class="col-span-full text-center py-12 px-4 border border-dashed border-gold rounded bg-[rgba(255,255,255,0.2)] font-heading">
                    <i class="fa-solid fa-scroll text-3xl text-gold/60 mb-2"></i>
                    <h4 class="text-xs font-bold text-blood uppercase tracking-widest mb-1">No ${scriptTerm} Available</h4>
                    <p class="text-[11px] text-555 font-serif italic max-w-md mx-auto">This vocation relies on physical training, discipline, or practical expertise. Select Features or assign a Script-trained vocation to view ${scriptTerm}.</p>
                </div>`;
            return;
        } else {
            if (includesTricks) levels.push(tricksTerm);
            for (let i = 1; i <= maxScriptLevel; i++) {
                levels.push(`Level ${i}`);
            }
        }
    }

    const canEdit = (currentUser?.username && char?.owner === currentUser?.username) || char?.owner === 'DM' || activeRole === 'dm';
    levels.forEach(lvl => { 
        const card = document.createElement('div'); card.className = "lvl-card"; const filtered = moves.filter(m => m.lvl === lvl && m.type === t); let html = `<div class="lvl-header">${lvl.toUpperCase()}</div><div class="flex-grow space-y-1">`;
        filtered.forEach(m => { const mIdx = moves.indexOf(m); html += `<div class="move-pill" ${canEdit ? `onclick="window.openMoveModal('${lvl}',${mIdx})"` : ''}><span class="move-name">${m.name}</span><span class="move-roll">${m.roll || ''}</span></div>`; });
        if (canEdit) html += `</div><button onclick="window.openMoveModal('${lvl}')" class="text-[9px] font-bold uppercase text-blood hover:text-ink text-center mt-2 font-heading transition-colors">+ ADD</button>`; else html += `</div>`;
        card.innerHTML = html; g.appendChild(card);
    }); 
};

// Global Firebase initialization & auth state setup omitted for brevity...
