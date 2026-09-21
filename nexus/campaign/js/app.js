import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, addDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

// --- DYNAMIC CLASS GENERATOR ---
const VOCATION_DATA = {
    'vanguard': {
        trackers: ['Guard Stance Tracker'],
        features: ['Vanguard Features', 'Defensive Techniques', 'Challenge Targets', 'Armor Training', 'Weapon Mastery'],
        equip: ['Primary Weapon', 'Shield/Defensive Gear', 'Heavy Equipment']
    },
    'warrior': {
        trackers: ['Battle Surge Tracker'],
        features: ['Combat Techniques', 'Weapon Specializations', 'Fighting Style', 'Tactical Maneuvers'],
        equip: ['Weapon Loadout', 'Ammunition', 'Combat Gear']
    },
    'heartbound': {
        trackers: ['Script Slots', 'Concords', 'Heart Resonance Tracker', 'Heart Strain Tracker'],
        features: ['Scriptcasting', 'Scriptcasting Focus', 'Component Satchel', 'Known Scripts', 'Core-Touched Effects', 'Mutation Effects'],
        equip: ['Heart Focus', 'Component Materials']
    },
    'peacekeeper': {
        trackers: ['Marked Targets Tracker'],
        features: ['Authority Features', 'Command Abilities', 'Tactical Orders', 'Protection Features'],
        equip: ['Badge/Emblem', 'Restraint Tools', 'Defensive Equipment']
    },
    'scavenger': {
        trackers: ['Salvage Cache', 'Salvage Materials'],
        features: ['Improvised Equipment', 'Relic Finds', 'Scrap Collection'],
        equip: ['Scavenging Tools', 'Salvage Kit', 'Storage Capacity']
    },
    'nomad': {
        trackers: ['Survival Resources', 'Companion Tracker'],
        features: ['Travel Features', 'Route Knowledge', 'Vehicle/Transport Features', 'Exploration Benefits'],
        equip: ['Travel Gear', 'Navigation Tools', 'Survival Supplies']
    },
    'warden': {
        trackers: ['Companion Tracker'],
        features: ['Nature Features', 'Tracking Abilities', 'Survival Techniques', 'Beast/Wildlife Knowledge'],
        equip: ['Warden Tools', 'Hunting Gear', 'Survival Equipment']
    },
    'chronicler': {
        trackers: ['Inspiration Tracker'],
        features: ['Recorded Knowledge', 'Lore Archive', 'Story/Memory Features', 'Research Notes'],
        equip: ['Journal', 'Recording Tools', 'Archive Materials']
    },
    'orator': {
        trackers: ['Script Slots', 'Concords', 'Inspiration Pool', 'Influence Tracker'],
        features: ['Scriptcasting', 'Scriptcasting Focus', 'Component Satchel', 'Known Scripts', 'Social Abilities'],
        equip: ['Focus Item', 'Performance/Communication Tools', 'Components']
    },
    'scriptweaver': {
        trackers: ['Script Slots', 'Concords'],
        features: ['Scriptcasting', 'Scriptcasting Focus', 'Component Satchel', 'Known Scripts', 'Prepared Scripts', 'Script Modifiers'],
        equip: ['Script Focus', 'Component Materials', 'Script Archive']
    },
    'wartouched': {
        trackers: ['Core Energy Tracker', 'Mutation Tracker', 'Instability Tracker'],
        features: ['Transformation Abilities', 'Enhanced Physiology Features', 'Core-Touched Effects'],
        equip: ['Core Relic', 'Mutation Records']
    },
    'archivist': {
        trackers: ['Script Slots', 'Concords'],
        features: ['Scriptcasting', 'Scriptcasting Focus', 'Component Satchel', 'Known Scripts', 'Prepared Scripts', 'Archive Codex', 'Research Database', 'Relic Records'],
        equip: ['Archive Tools', 'Data Storage', 'Research Materials']
    },
    'fabricator': {
        trackers: ['Script Slots', 'Concords', 'Construct Tracker', 'Active Creations'],
        features: ['Scriptcasting', 'Scriptcasting Focus', 'Component Satchel', 'Known Scripts', 'Fabrication Toolkit', 'Schematics', 'Crafting Materials'],
        equip: ['Fabrication Tools', 'Workshop Supplies', 'Components']
    }
};

window.currentRenderedClass = null;

window.getVocationAliases = () => {
    const t = campaignSettings?.terms || {};
    return {
        'vanguard': (t.class_vanguard || 'vanguard').toLowerCase(),
        'warrior': (t.class_warrior || 'warrior').toLowerCase(),
        'peacekeeper': (t.class_peacekeeper || 'peacekeeper').toLowerCase(),
        'scavenger': (t.class_scavenger || 'scavenger').toLowerCase(),
        'heartbound': (t.class_heartbound || 'heartbound').toLowerCase(),
        'nomad': (t.class_nomad || 'nomad').toLowerCase(),
        'warden': (t.class_warden || 'wilderness warden').toLowerCase(),
        'chronicler': (t.class_chronicler || 'chronicler').toLowerCase(),
        'orator': (t.class_orator || 'orator').toLowerCase(),
        'scriptweaver': (t.class_scriptweaver || 'scriptweaver').toLowerCase(),
        'wartouched': (t.class_wartouched || 'war-touched').toLowerCase(),
        'archivist': (t.class_archivist || 'archivist').toLowerCase(),
        'fabricator': (t.class_fabricator || 'fabricator').toLowerCase()
    };
};

window.getHitDie = (className) => {
    if (!className) return 8; // Default
    const c = className.toLowerCase();
    const aliases = window.getVocationAliases();
    if (c.includes(aliases['vanguard'])) return 12;
    if (c.includes(aliases['warrior']) || c.includes(aliases['heartbound']) || c.includes(aliases['nomad'])) return 10;
    if (c.includes(aliases['scriptweaver']) || c.includes(aliases['archivist'])) return 6;
    return 8; // Default for Orator, Chronicler, Warden, Peacekeeper, Scavenger, War-Touched, Fabricator
};

window.autoCalcHP = (force = false) => {
    const char = characters.find(c => c.id === activeCharId);
    if (!char) return;
    
    const conMod = Math.floor(((parseInt(document.querySelector('[data-key="con"]')?.value) || 10) - 10) / 2);
    let totalHp = 0;
    let hdParts = [];
    
    let classes = char.classes || [];
    if (classes.length === 0) {
        classes = [{name: document.getElementById('class-input')?.value || '', level: parseInt(document.querySelector('[data-key="level"]')?.value) || 1}];
    }
    
    classes.forEach((cls, idx) => {
        const hd = window.getHitDie(cls.name);
        const lvl = parseInt(cls.level) || 1;
        if (lvl > 0) hdParts.push(`${lvl}d${hd}`);
        
        for (let i = 0; i < lvl; i++) {
            if (idx === 0 && i === 0) {
                totalHp += (hd + conMod); // Level 1 Max HP rule
            } else {
                totalHp += (Math.floor(hd / 2) + 1 + conMod); // Standard Average HP level up rule
            }
        }
    });
    
    const hdString = hdParts.join(' + ') || '1d8';
    const hdInput = document.querySelector('[data-key="hd"]');
    
    if (hdInput && (force || hdInput.value === '1d8' || hdInput.value === '1d10' || hdInput.value === '')) {
        hdInput.value = hdString;
    }

    const maxHpInput = document.querySelector('[data-key="hpMax"]');
    if (maxHpInput) {
        if (force || parseInt(maxHpInput.value) === 10) {
            maxHpInput.value = totalHp;
            const curHpInput = document.querySelector('[data-key="hpCurrent"]');
            if (curHpInput && (force || parseInt(curHpInput.value) === 10)) {
                curHpInput.value = totalHp;
            }
        }
    }
    
    if (force) {
        window.saveCurrentCharacter();
        window.showToast(`Max HP set to ${totalHp} (Average + CON)`);
    }
};

window.updateClassSpecifics = () => {
    const inputVal = (document.getElementById('class-input')?.value || '').toLowerCase();
    let matchedClasses = [];
    const aliases = window.getVocationAliases();
    for (const k in VOCATION_DATA) {
        if (inputVal.includes(aliases[k])) {
            matchedClasses.push(k);
        }
    }

    const matchKey = matchedClasses.sort().join(',');
    if (matchKey === window.currentRenderedClass) return;
    window.currentRenderedClass = matchKey;

    const tCard = document.getElementById('dynamic-class-trackers-card');
    const tContent = document.getElementById('dynamic-class-trackers-content');
    const fSection = document.getElementById('dynamic-class-features-section');
    const fContent = document.getElementById('dynamic-class-features-content');
    const eSection = document.getElementById('dynamic-class-equip-section');
    const eContent = document.getElementById('dynamic-class-equip-content');

    if (matchedClasses.length === 0) {
        if(tCard) tCard.classList.add('hidden');
        if(fSection) fSection.classList.add('hidden');
        if(eSection) eSection.classList.add('hidden');
        return;
    }

    let allTrackers = [];
    let allFeatures = [];
    let allEquip = [];

    matchedClasses.forEach(matchedClass => {
        const data = VOCATION_DATA[matchedClass];
        allTrackers = [...new Set([...allTrackers, ...data.trackers])];
        allFeatures = [...new Set([...allFeatures, ...data.features])];
        allEquip = [...new Set([...allEquip, ...data.equip])];
    });

    if (tCard && tContent) {
        if (allTrackers.length > 0) {
            tCard.classList.remove('hidden');
            document.getElementById('dynamic-class-title').innerText = 'VOCATION TRACKERS';
            tContent.innerHTML = allTrackers.map(t => `
                <div class="flex justify-between items-center mb-2">
                    <label class="tiny-label mt-0">${t}</label>
                    <input type="text" data-key="tracker_${t.replace(/[^a-zA-Z0-9]/g,'_')}" class="w-16 bg-transparent border-b border-dashed border-gray-400 text-center font-bold text-ink font-heading text-lg" placeholder="0">
                </div>
            `).join('');
        } else {
            tCard.classList.add('hidden');
        }
    }

    if (fSection && fContent) {
        if (allFeatures.length > 0) {
            fSection.classList.remove('hidden');
            fContent.innerHTML = allFeatures.map(f => `
                <div class="trait-section">
                    <label class="trait-title">${f}</label>
                    <textarea data-key="feature_${f.replace(/[^a-zA-Z0-9]/g,'_')}" class="trait-input-area font-serif" placeholder="+ Add details..."></textarea>
                </div>
            `).join('');
        } else {
            fSection.classList.add('hidden');
        }
    }

    if (eSection && eContent) {
        if (allEquip.length > 0) {
            eSection.classList.remove('hidden');
            eContent.innerHTML = allEquip.map(e => `
                <div>
                    <label class="prof-label mb-1">${e}</label>
                    <textarea data-key="equip_${e.replace(/[^a-zA-Z0-9]/g,'_')}" class="w-full bg-[rgba(255,255,255,0.4)] border border-[rgba(139,90,43,0.3)] p-2 rounded text-[12px] h-16 font-serif" placeholder="List items..."></textarea>
                </div>
            `).join('');
        } else {
            eSection.classList.add('hidden');
        }
    }

    if (activeCharId && characters) {
        const char = characters.find(c => c.id === activeCharId);
        if (char) {
            const isOwner = (currentUser && char.owner === currentUser.username) || char.owner === 'DM';
            const isDM = activeRole === 'dm';
            const canEdit = isOwner || isDM;

            document.querySelectorAll('#dynamic-class-trackers-card [data-key], #dynamic-class-features-section [data-key], #dynamic-class-equip-section [data-key]').forEach(el => {
                const rawVal = char[el.dataset.key]; 
                el.value = (rawVal !== undefined && rawVal !== null) ? rawVal : "";
                el.readOnly = !canEdit;
                el.disabled = !canEdit;
            });
        }
    }
};

window.showToast = (m) => { 
    const t = document.getElementById('toast'); 
    if(t){ t.textContent=m; t.style.opacity=1; setTimeout(()=>t.style.opacity=0, 4000); } 
};

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

const urlParams = new URLSearchParams(window.location.search);
let appId = urlParams.get('id') || urlParams.get('campaignId');

const isPreviewEnv = window.location.href.startsWith('blob:') || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

if (!appId) {
    if (isPreviewEnv) {
        appId = "demo_campaign";
    } else {
        try {
            // STEP OUT TO NEXUS DIRECTORY IF NO CAMPAIGN ID
            window.location.href = "../campaigns.html";
        } catch(e) {}
    }
}

window.routeTo = (page) => {
    try {
        let targetUrl = page;
        
        // Step out to nexus folder if heading back to campaigns
        if (page === 'campaigns.html') {
            targetUrl = '../campaigns.html';
        }

        if (appId && appId !== "demo_campaign") {
            if (page !== 'campaigns.html') {
                targetUrl += `?id=${appId}`;
            }
        }
        window.location.href = targetUrl;
    } catch (e) {
        window.showToast("Navigation blocked in preview.");
    }
};

let characters = [], parties = [], currentUser = null, activeCharId = null, activeRole = 'player', rollMode = 'normal';
let autoSaveTimer = null, lastGeneratedScores = [], sessionRerollUsed = false;
let activeManagePartyId = null, activeMoveLvl = null, editingMoveIndex = null;
let currentRound = 1, activeTurnId = null, pendingHoldId = null;
let campaignSettings = { terms: {} };

const SHEET_LABELS = {
    class: 'Class', level: 'Level', party: 'Party', race: 'Race', archetype: 'Archetype', belief: 'Belief',
    insp: 'Insp', abilities: 'Abilities', prof: 'Proficiency', saves: 'Saves', skills: 'Skills', ac: 'AC', init: 'INIT', speed: 'Speed',
    hp: 'Health Points', hd: 'HD', temphp: 'Temporary Hit Points', death: 'Death & Coma', stress: 'Stress', trauma: 'Trauma',
    actions: 'Actions', attacks: 'Attacks & Scriptcasting', defenses: 'Defenses', conditions: 'Conditions & Exhaustion', proficiencies: 'Proficiencies & Training',
    inventory: 'Inventory', currency: 'Currency', equipment: 'Equipment', traits: 'Traits', personality: 'Personality Traits', ideals: 'Ideals', bonds: 'Bonds', flaws: 'Flaws',
    background: 'Background', characteristics: 'Characteristics & Appearance', companion: 'Companion', notes: 'Notes'
};

const STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const SKILLS = [
    {n:'Acrobatics', s:'dex'},{n:'Animal Handling', s:'wis'},{n:'Arcana', s:'int'},
    {n:'Athletics', s:'str'},{n:'Deception', s:'cha'},{n:'History', s:'int'},
    {n:'Insight', s:'wis'},{n:'Intimidation', s:'cha'},{n:'Investigation', s:'int'},
    {n:'Medicine', s:'wis'},{n:'Nature', s:'int'},{n:'Perception', s:'wis'},
    {n:'Performance', s:'cha'},{n:'Persuasion', s:'cha'},{n:'Belief', s:'int'},
    {n:'Sleight of Hand', s:'dex'},{n:'Stealth', s:'dex'},{n:'Survival', s:'wis'}
];

const COMA_COMPLICATIONS = [
    "Memory loss (temporary or permanent)",
    "Mutation / Core scarring",
    "Reduced max HP until treated",
    "Visions of the Eternal Heart",
    "Faction interest or unwanted attention",
    "Changed personality trait or belief",
    "Assisted Recovery"
];

const getRoll = (sides) => Math.floor(Math.random() * sides) + 1;

// --- SCARS & TRAUMA FRAMEWORK GENERATOR ---
window.generateScarsAndTrauma = () => {
    const getD100 = () => Math.floor(Math.random() * 100) + 1;
    const getD20 = () => Math.floor(Math.random() * 20) + 1;

    // Step 1 - Severity
    const r1 = getD100();
    const scarSev = r1 <= 15 ? "No significant scar" : r1 <= 30 ? "Minor scar" : r1 <= 50 ? "Noticeable scar" : r1 <= 70 ? "Severe scar" : r1 <= 85 ? "Multiple scars" : r1 <= 95 ? "Major disfigurement" : "Permanent injury";

    // Step 2 - Type
    const r2 = getD100();
    const scarType = r2 <= 8 ? "Burn" : r2 <= 16 ? "Cut" : r2 <= 24 ? "Puncture" : r2 <= 32 ? "Bite" : r2 <= 40 ? "Fracture" : r2 <= 48 ? "Chemical/acid damage" : r2 <= 55 ? "Electrical damage" : r2 <= 62 ? "Script-related injury" : r2 <= 69 ? "Fracture exposure" : r2 <= 76 ? "Surgical/experimental" : r2 <= 82 ? "Creature attack" : r2 <= 88 ? "Machinery accident" : r2 <= 93 ? "Battlefield injury" : r2 <= 97 ? "Missing/damaged body part" : "Strange/unexplained scar";

    // Step 3 - Location
    const r3 = getD100();
    const scarLoc = r3 <= 10 ? "Head" : r3 <= 18 ? "Face" : r3 <= 25 ? "Neck" : r3 <= 35 ? "Chest" : r3 <= 45 ? "Back" : r3 <= 53 ? "Arm" : r3 <= 61 ? "Hand" : r3 <= 69 ? "Leg" : r3 <= 77 ? "Foot" : r3 <= 85 ? "Multiple locations" : r3 <= 92 ? "Hidden beneath clothing" : r3 <= 97 ? "Visible to everyone" : "Unusual location";

    // Step 4 - Cause
    const r4 = getD100();
    const scarCause = r4 <= 10 ? "Childhood accident" : r4 <= 20 ? "Wilderness accident" : r4 <= 30 ? "Creature attack" : r4 <= 40 ? "Combat" : r4 <= 48 ? "Failed Script" : r4 <= 55 ? "Industrial machinery" : r4 <= 62 ? "Fracture event" : r4 <= 68 ? "Fire" : r4 <= 74 ? "Acid/Chemical" : r4 <= 80 ? "Collapse/Disaster" : r4 <= 85 ? "Captivity" : r4 <= 90 ? "Experimentation" : r4 <= 94 ? "Deliberately caused by someone" : r4 <= 97 ? "Self-inflicted" : "Unknown";

    // Step 6 - Trauma Severity
    const r6 = getD20();
    const traumaSev = r6 <= 5 ? "Difficult memory" : r6 <= 10 ? "Lingering experience" : r6 <= 14 ? "Significant trauma" : r6 <= 17 ? "Deep trauma" : r6 <= 19 ? "Life-defining trauma" : "Defining event";

    // Step 7 - Event
    const r7 = getD100();
    const traumaEv = r7 <= 10 ? "Someone important died" : r7 <= 20 ? "Someone important disappeared" : r7 <= 30 ? "Home was destroyed" : r7 <= 40 ? "Betrayed by trusted person" : r7 <= 50 ? "Failed to save someone" : r7 <= 60 ? "Imprisoned/Captive" : r7 <= 68 ? "Hunted" : r7 <= 75 ? "Witnessed something horrific" : r7 <= 82 ? "Forced to hurt someone" : r7 <= 88 ? "Abandoned someone" : r7 <= 94 ? "Survived when others didn't" : r7 <= 97 ? "Caused unintended disaster" : "Fracture event connection";

    // Step 8 - Person Involved
    const r8 = getD100();
    const personInv = r8 <= 15 ? "Parent" : r8 <= 25 ? "Sibling" : r8 <= 35 ? "Child" : r8 <= 45 ? "Friend" : r8 <= 55 ? "Mentor" : r8 <= 65 ? "Romantic partner" : r8 <= 72 ? "Commander/Superior" : r8 <= 80 ? "Entire community" : r8 <= 87 ? "Stranger" : r8 <= 93 ? "Enemy" : r8 <= 97 ? "Themselves" : "Unknown";

    // Step 9 - Trigger
    const r9 = getD100();
    const traumaTrig = r9 <= 10 ? "Certain sound" : r9 <= 20 ? "Certain smell" : r9 <= 30 ? "Fire" : r9 <= 38 ? "Darkness" : r9 <= 46 ? "Blood or injury" : r9 <= 54 ? "Confinement" : r9 <= 62 ? "Being restrained" : r9 <= 69 ? "Machinery" : r9 <= 76 ? "A particular creature" : r9 <= 82 ? "A particular Script" : r9 <= 88 ? "Someone dying" : r9 <= 93 ? "Being abandoned" : r9 <= 97 ? "Losing control" : "Specific original event link";

    // Step 10 & 11 - Response & Coping
    const r10 = getD100();
    const resp = r10 <= 20 ? "Fight — confront threat" : r10 <= 35 ? "Flight — escape/distance" : r10 <= 50 ? "Freeze — hesitate/overwhelmed" : r10 <= 60 ? "Focus — intensely practical" : r10 <= 70 ? "Protect — protect others" : r10 <= 80 ? "Control — attempt control" : r10 <= 90 ? "Withdraw — quiet/distant" : r10 <= 95 ? "Deflect — humor/anger" : "Adapt — search for solution";

    const r11 = getD100();
    const cope = r11 <= 8 ? "Maintain equipment" : r11 <= 16 ? "Train constantly" : r11 <= 24 ? "Keep busy" : r11 <= 32 ? "Make jokes" : r11 <= 40 ? "Stay close to trusted people" : r11 <= 48 ? "Avoid talking about it" : r11 <= 55 ? "Talk openly" : r11 <= 62 ? "Strict routines" : r11 <= 69 ? "Collect keepsakes" : r11 <= 76 ? "Help others" : r11 <= 82 ? "Study the event" : r11 <= 88 ? "Travel constantly" : r11 <= 94 ? "Create art/music" : "Turn into personal mission";

    // Step 12 - Mechanical Effect
    const r12 = getD20();
    const eff = r12 <= 10 ? "Narrative Only" : r12 <= 14 ? "Roleplay Trait" : r12 <= 17 ? "Situational Benefit" : r12 <= 19 ? "Situational Complication" : "Benefit & Complication";

    // Populate Fields safely
    const setKeyVal = (key, val) => {
        const el = document.querySelector(`[data-key="${key}"]`);
        if (el) el.value = val;
    };

    setKeyVal("scarDesc", `${scarSev} (${scarType})`);
    setKeyVal("scarLocation", scarLoc);
    setKeyVal("scarCause", scarCause);
    setKeyVal("traumaEvent", `${traumaEv} (Involving: ${personInv})`);
    setKeyVal("traumaSeverity", traumaSev);
    setKeyVal("traumaTrigger", traumaTrig);
    setKeyVal("traumaResponse", `${resp} / ${cope}`);
    setKeyVal("traumaStrength", `Mechanical Effect: ${eff}`);
    setKeyVal("traumaComplication", `DM Narrative Hook: Triggered by ${traumaTrig}`);

    window.saveCurrentCharacter();
    window.showToast("Scars & Trauma Framework Generated!");
};

const DEFAULT_MODULES = {
    mod_skills: true, mod_saves: true, mod_insp: true, mod_death: true,
    mod_stress: true, mod_conditions: true, mod_defenses: true,
    mod_currency: true, mod_inventory: true, mod_background: true, mod_companion: true
};

window.switchSheetTab = (tabId) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
    const btn = document.getElementById(`tab-btn-${tabId}`); if(btn) btn.classList.add('active');
    const pane = document.getElementById(`tab-content-${tabId}`); if(pane) pane.classList.remove('hidden');
};

window.openSettingsModal = () => {
    const t = campaignSettings.terms || {};
    const mods = campaignSettings.modules || DEFAULT_MODULES;

    document.getElementById('term-nav_party').value = t.nav_party || 'Party';
    document.getElementById('term-nav_npcs').value = t.nav_npcs || 'NPCs';
    document.getElementById('term-nav_beasts').value = t.nav_beasts || 'Bestiary';
    document.getElementById('term-nav_backpack').value = t.nav_backpack || 'Backpack';
    document.getElementById('term-nav_handbook').value = t.nav_handbook || 'Handbook';
    document.getElementById('term-nav_graveyard').value = t.nav_graveyard || 'Graveyard';
    document.getElementById('term-nav_logs').value = t.nav_logs || 'Logs';

    document.getElementById('term-book_vocations').value = t.book_vocations || 'Vocations';
    document.getElementById('term-book_lineages').value = t.book_lineages || 'Lineages';
    document.getElementById('term-book_backgrounds').value = t.book_backgrounds || 'Backgrounds';
    document.getElementById('term-book_landmarks').value = t.book_landmarks || 'Landmarks';
    document.getElementById('term-book_scriptcodex').value = t.book_scriptcodex || 'Script Codex';
    document.getElementById('term-book_artifacts').value = t.book_artifacts || 'Gear & Artifacts';
    document.getElementById('term-book_worldlore').value = t.book_worldlore || 'World Lore';
    document.getElementById('term-lore_custodians').value = t.lore_custodians || "Custodian's Athenaeum";
    document.getElementById('term-lore_archivists').value = t.lore_archivists || "Archivist Public Library";

    document.getElementById('term-class_vanguard').value = t.class_vanguard || 'Vanguard';
    document.getElementById('term-class_warrior').value = t.class_warrior || 'Warrior';
    document.getElementById('term-class_peacekeeper').value = t.class_peacekeeper || 'Peacekeeper';
    document.getElementById('term-class_scavenger').value = t.class_scavenger || 'Scavenger';
    document.getElementById('term-class_heartbound').value = t.class_heartbound || 'Heartbound';
    document.getElementById('term-class_nomad').value = t.class_nomad || 'Nomad';
    document.getElementById('term-class_warden').value = t.class_warden || 'Wilderness Warden';
    document.getElementById('term-class_chronicler').value = t.class_chronicler || 'Chronicler';
    document.getElementById('term-class_orator').value = t.class_orator || 'Orator';
    document.getElementById('term-class_scriptweaver').value = t.class_scriptweaver || 'Scriptweaver';
    document.getElementById('term-class_wartouched').value = t.class_wartouched || 'War-Touched';
    document.getElementById('term-class_archivist').value = t.class_archivist || 'Archivist';
    document.getElementById('term-class_fabricator').value = t.class_fabricator || 'Fabricator';

    Object.keys(SHEET_LABELS).forEach(k => {
        const el = document.getElementById(`term-sheet_${k}`);
        if(el) el.value = t[`sheet_${k}`] || SHEET_LABELS[k];
    });

    Object.keys(DEFAULT_MODULES).forEach(k => {
        const el = document.getElementById(k);
        if (el) el.checked = mods[k] !== false; // defaults to true
    });

    document.getElementById('settings-modal').classList.remove('hidden');
};

window.saveTerminology = async () => {
    const terms = {
        nav_party: document.getElementById('term-nav_party').value.trim() || 'Party',
        nav_npcs: document.getElementById('term-nav_npcs').value.trim() || 'NPCs',
        nav_beasts: document.getElementById('term-nav_beasts').value.trim() || 'Bestiary',
        nav_backpack: document.getElementById('term-nav_backpack').value.trim() || 'Backpack',
        nav_handbook: document.getElementById('term-nav_handbook').value.trim() || 'Handbook',
        nav_graveyard: document.getElementById('term-nav_graveyard').value.trim() || 'Graveyard',
        nav_logs: document.getElementById('term-nav_logs').value.trim() || 'Logs',

        book_vocations: document.getElementById('term-book_vocations').value.trim() || 'Vocations',
        book_lineages: document.getElementById('term-book_lineages').value.trim() || 'Lineages',
        book_backgrounds: document.getElementById('term-book_backgrounds').value.trim() || 'Backgrounds',
        book_landmarks: document.getElementById('term-book_landmarks').value.trim() || 'Landmarks',
        book_scriptcodex: document.getElementById('term-book_scriptcodex').value.trim() || 'Script Codex',
        book_artifacts: document.getElementById('term-book_artifacts').value.trim() || 'Gear & Artifacts',
        book_worldlore: document.getElementById('term-book_worldlore').value.trim() || 'World Lore',
        lore_custodians: document.getElementById('term-lore_custodians').value.trim() || "Custodian's Athenaeum",
        lore_archivists: document.getElementById('term-lore_archivists').value.trim() || "Archivist Public Library",

        class_vanguard: document.getElementById('term-class_vanguard').value.trim() || 'Vanguard',
        class_warrior: document.getElementById('term-class_warrior').value.trim() || 'Warrior',
        class_peacekeeper: document.getElementById('term-class_peacekeeper').value.trim() || 'Peacekeeper',
        class_scavenger: document.getElementById('term-class_scavenger').value.trim() || 'Scavenger',
        class_heartbound: document.getElementById('term-class_heartbound').value.trim() || 'Heartbound',
        class_nomad: document.getElementById('term-class_nomad').value.trim() || 'Nomad',
        class_warden: document.getElementById('term-class_warden').value.trim() || 'Wilderness Warden',
        class_chronicler: document.getElementById('term-class_chronicler').value.trim() || 'Chronicler',
        class_orator: document.getElementById('term-class_orator').value.trim() || 'Orator',
        class_scriptweaver: document.getElementById('term-class_scriptweaver').value.trim() || 'Scriptweaver',
        class_wartouched: document.getElementById('term-class_wartouched').value.trim() || 'War-Touched',
        class_archivist: document.getElementById('term-class_archivist').value.trim() || 'Archivist',
        class_fabricator: document.getElementById('term-class_fabricator').value.trim() || 'Fabricator'
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
        window.showToast("Settings Updated!");
    } catch (err) {
        console.error(err);
        window.showToast("Failed to save settings");
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
    
    safeSet('tab-btn-actions', terms.sheet_actions || SHEET_LABELS.actions);
    safeSet('tab-btn-inventory', terms.sheet_inventory || SHEET_LABELS.inventory);
    safeSet('tab-btn-features', terms.sheet_traits || SHEET_LABELS.traits);
    safeSet('tab-btn-background', terms.sheet_background || SHEET_LABELS.background);
    safeSet('tab-btn-companion', terms.sheet_companion || SHEET_LABELS.companion);
    safeSet('tab-btn-notes', terms.sheet_notes || SHEET_LABELS.notes);

    const vt = document.getElementById('view-title');
    if (vt) {
        if (vt.innerText === 'The Party' || vt.innerText === (campaignSettings?.terms?.nav_party || 'Party')) {
            vt.innerText = terms.nav_party || 'The Party';
        }
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
    
    if (mods.mod_inventory === false && document.getElementById('tab-btn-inventory')?.classList.contains('active')) window.switchSheetTab('actions');
    if (mods.mod_background === false && document.getElementById('tab-btn-background')?.classList.contains('active')) window.switchSheetTab('actions');
    if (mods.mod_companion === false && document.getElementById('tab-btn-companion')?.classList.contains('active')) window.switchSheetTab('actions');
};

window.switchSubFilter = (filterId) => {
    document.querySelectorAll('.sub-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`sub-btn-${filterId}`); if(btn) btn.classList.add('active');
    const panes = document.querySelectorAll('.sub-pane');
    panes.forEach(p => { if (filterId === 'all') p.classList.remove('hidden'); else p.classList.toggle('hidden', p.id !== `sub-content-${filterId}`); });
};

function renderMedia(src, className, style = "") {
    if (!src) return ''; 
    const srcLower = src.toLowerCase(); const isVideo = srcLower.endsWith('.mp4') || srcLower.endsWith('.webm') || srcLower.includes('mp4');
    if (isVideo) return `<video src="${src}" class="${className}" style="${style}" autoplay loop muted playsinline></video>`;
    return `<img src="${src}" class="${className}" style="${style}" onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-[10px] text-blood font-bold px-1\\'>Broken Media</div>'">`;
}

window.openPartyModal = () => { document.getElementById('party-modal')?.classList.remove('hidden'); };
window.createParty = async () => { const n = document.getElementById('party-name-input'); if (!n || !n.value) return; await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'parties'), {name: n.value, createdAt: Date.now()}); document.getElementById('party-modal').classList.add('hidden'); n.value = ''; window.showToast("Party Formed"); };

window.openCompanionSheet = (e, petId) => {
    e.stopPropagation(); // Stops the click from opening the PC sheet
    try {
        let targetUrl = `companions.html?openSheet=${petId}`;
        if (appId && appId !== "demo_campaign") {
            targetUrl += `&id=${appId}`;
        }
        window.location.href = targetUrl;
    } catch (err) {
        window.showToast("Redirects disabled in preview window.");
    }
};
window.renderDashboard = () => {
    const pcC = document.getElementById('party-view-container');
    if (!pcC) return; 
    pcC.innerHTML = ''; 
    
    const activePCs = characters.filter(c => c.type === 'PC' && !c.isDeleted);
    
    parties.forEach(p => {
        const s = document.createElement('div'); s.className = "bg-black/60 p-6 rounded border border-gray-700 shadow-xl mb-8";
        s.innerHTML = `<div class="flex justify-between items-center mb-4"><h3 class="text-gold font-heading font-bold uppercase text-sm">${p.name}</h3><button onclick="window.openManageParty('${p.id}')" class="text-[9px] font-black uppercase text-gray-500 hover:text-gold bg-black/40 border border-gray-700 px-2 py-1 rounded font-heading">Manage</button></div><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="party-grid-${p.id}"></div>`;
        pcC.appendChild(s); const g = s.querySelector(`#party-grid-${p.id}`); activePCs.filter(c => c.partyId === p.id).forEach(c => g.appendChild(createCard(c)));
    });
    const unassignedPCs = activePCs.filter(c => !c.partyId);
    if (unassignedPCs.length > 0) {
        const s = document.createElement('div'); s.className = "space-y-4 mb-8";
        s.innerHTML = `<h3 class="text-gray-500 font-heading font-bold uppercase text-sm mb-4">Unassigned Adventurers</h3><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="unassigned-grid"></div>`;
        pcC.appendChild(s); const g = s.querySelector('#unassigned-grid'); unassignedPCs.forEach(c => g.appendChild(createCard(c)));
    }
};

function createCard(c) {
    let statusClass = "border-gold", badgeHtml = "", imgStyle = "";
    if (c.status === 'coma') { statusClass = "border-[#f59e0b] shadow-[0_0_15px_rgba(245,158,11,0.2)]"; badgeHtml += `<span class="status-badge badge-coma" style="right: 8px">Coma</span>`; }
    else if (c.status === 'dead') { statusClass = "border-[#1a1a1a] opacity-70 grayscale"; badgeHtml += `<span class="status-badge badge-dead" style="right: 8px">Dead</span>`; imgStyle = "filter: grayscale(1)"; }
    
    if (currentUser && c.owner === currentUser.username) badgeHtml += `<span class="status-badge bg-green-900 border border-green-700 text-parchment" style="left: 8px; right: auto;">YOURS</span>`;
    else if (!c.owner && c.type !== 'NPC' && c.type !== 'BEAST') badgeHtml += `<span class="status-badge bg-gray-700 border border-gray-500 text-parchment" style="left: 8px; right: auto;">UNCLAIMED</span>`;
    
    const mediaSrc = c.imageSrc ? renderMedia(c.imageSrc, "w-full h-full object-cover", imgStyle) : `<div class="w-full h-full flex items-center justify-center text-xl" style="${imgStyle}">👤</div>`;
    const d = document.createElement('div'); 
    d.className = `bg-black/70 rounded card border-l-4 flex flex-col overflow-hidden ${statusClass}`;
    
    let innerHtml = `
        <div class="p-4 md:p-5 relative flex-grow hover:bg-gray-800 transition-colors" onclick="window.openSheet('${c.id}')">
            ${badgeHtml}
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded bg-gray-900 border border-gray-700 overflow-hidden relative shrink-0">${mediaSrc}</div>
                <div class="flex-grow min-w-0">
                    <h5 class="text-gold font-heading font-bold text-sm md:text-base leading-tight truncate">${c.name}</h5>
                    <p class="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5 font-heading">${c.class || 'Class'} Lvl ${c.level || 1}</p>
                </div>
            </div>
        </div>
    `;
    
    if (c.companionId) {
        const pet = characters.find(p => p.id === c.companionId && !p.isDeleted);
        if (pet) {
            const petMedia = pet.imageSrc ? `<img src="${pet.imageSrc}" class="w-8 h-8 rounded-full object-cover border-gold">` : `<div class="w-8 h-8 rounded-full bg-gray-900 border border-gold flex items-center justify-center text-[10px]">🐾</div>`;
            innerHtml += `
                <div class="bg-black/90 border-t border-gray-700 p-3 flex items-center gap-3 hover:bg-gray-900 transition-colors cursor-pointer" onclick="window.openCompanionSheet(event, '${pet.id}')">
                    ${petMedia}
                    <div class="flex-grow">
                        <span class="block text-[8px] font-bold uppercase text-gold tracking-widest block leading-none mb-1 font-heading">Companion</span>
                        <span class="text-xs font-bold text-gray-300 leading-none font-heading">${pet.name}</span>
                    </div>
                    <div class="text-right font-heading">
                        <span class="block text-[8px] text-gray-500 font-bold uppercase mb-0.5">HP <span class="${pet.hpCurrent < (pet.hpMax/2) ? 'text-blood' : 'text-green-600'}">${pet.hpCurrent}/${pet.hpMax}</span></span>
                        <span class="text-gray-600 text-xs">➔</span>
                    </div>
                </div>
            `;
        }
    }
    d.innerHTML = innerHtml;
    return d;
}

window.openSheet = (id) => { activeCharId = id; document.getElementById('dashboard-screen')?.classList.add('hidden-view'); document.getElementById('sheet-screen')?.classList.remove('hidden-view'); document.getElementById('quick-roll-bar')?.classList.remove('hidden-view'); document.getElementById('quick-notes-bar')?.classList.remove('hidden-view'); initSheetUI(); syncSheetData(); window.switchSheetTab('actions'); window.switchSubFilter('all'); window.scrollTo(0,0); };
window.closeSheet = () => { activeCharId = null; document.getElementById('sheet-screen')?.classList.add('hidden-view'); document.getElementById('dashboard-screen')?.classList.remove('hidden-view'); document.getElementById('quick-roll-bar')?.classList.add('hidden-view'); document.getElementById('quick-notes-bar')?.classList.add('hidden-view'); window.scrollTo(0,0);};

window.createChar = async (type) => { 
    if (!currentUser) return; 
    try { 
        const initialOwner = (activeRole === 'dm' ? null : currentUser.username);
        const ref = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'characters'), { 
            type, 
            name: `New Adventurer`, 
            class: "",
            ownerId: currentUser.uid, 
            owner: initialOwner, 
            isDeleted: false, 
            status: 'alive', 
            hpMax: 10, 
            hpCurrent: 10, 
            tempHp: 0,
            level: 1, 
            str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, 
            profBonus: 2, 
            scoresGenerated: false, 
            languages: [], 
            attacks: [], 
            moves: [], 
            dmWhispers: [], 
            dsSucc: 0, dsFail: 0, 
            hdCurrent: 1, hd: "1d8", 
            age: "", gender: "", alignment: "Neutral", faith: "", hair: "", skin: "", size: "Medium", height: "", weight: "", appearance: "", 
            backgroundTitle: "New Background", backgroundDesc: "", 
            profArmor: "", profWeapons: "", profTools: "", 
            imageSrc: "", heroicInspiration: 0, exhaustion: 0, 
            currentStress: 0, stressThreshold: 10,
            passivePerception: 10,
            init: "",
            isInCombat: false
        }); 
        window.openSheet(ref.id); 
    } catch (e) { window.showToast("Create Failed"); } 
};

function initSheetUI() {
    const sC = document.getElementById('stats-container'), svC = document.getElementById('saves-container'), skC = document.getElementById('skills-container');
    if (!sC) return; sC.innerHTML = ''; svC.innerHTML = ''; skC.innerHTML = '';
    STATS.forEach(s => { 
        sC.innerHTML += `<div class="flex items-center gap-3"><div class="w-12 h-12 bg-[rgba(255,255,255,0.5)] rounded flex flex-col items-center justify-center border border-[rgba(139,90,43,0.4)] font-black rollable cursor-pointer hover:border-blood hover:bg-[rgba(197,160,89,0.2)] transition-colors" onclick="window.rollStat('${s}')"><span class="text-[8px] uppercase text-555 font-heading">${s}</span><span id="mod-${s}" class="text-ink">+0</span></div><input type="number" data-key="${s}" class="w-10 text-center font-bold text-ink" value="10" onchange="window.calcMods()"></div>`; 
        svC.innerHTML += `<div class="stat-row"><input type="checkbox" data-key="save_prof_${s}" class="prof-checkbox" onchange="window.calcMods()"><span class="stat-attr-tag">${s}</span><span class="stat-label-text">Save</span><span class="stat-mod-box" id="save-mod-${s}" onclick="window.rollSave('${s}')">+0</span></div>`;
    });
    SKILLS.forEach(sk => { 
        const safe = sk.n.toLowerCase().replace(/ /g,'_').replace(/[()]/g,''); 
        skC.innerHTML += `<div class="stat-row"><input type="checkbox" data-key="prof_${safe}" class="prof-checkbox" onchange="window.calcMods()"><span class="stat-attr-tag">${sk.s}</span><span class="stat-label-text">${sk.n}</span><span class="stat-mod-box" id="skill-mod-${safe}" onclick="window.rollSkill('${sk.n}')">+0</span></div>`; 
    });
}

window.handleComaToggle = async (val) => {
    const char = characters.find(c => c.id === activeCharId);
    if (!char) return;
    const isOwner = (currentUser && char.owner === currentUser.username) || char.owner === 'DM';
    const isDM = activeRole === 'dm';
    if (!isOwner && !isDM) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), { comaActive: val, dsSucc: 0, dsFail: 0 });
};

function syncSheetData() {
    const char = characters.find(c => c.id === activeCharId); if (!char) return;
    const ps = document.getElementById('party-select'); if (ps) { ps.innerHTML = '<option value="">Unassigned</option>'; parties.forEach(p => ps.innerHTML += `<option value="${p.id}">${p.name}</option>`); }
    const isOwner = (currentUser && char.owner === currentUser.username) || char.owner === 'DM'; 
    const isDM = activeRole === 'dm'; 
    const canEdit = isOwner || isDM; 

    document.querySelectorAll('#sheet-container input, #sheet-container textarea, #sheet-container select').forEach(el => { if (el.tagName === 'SELECT' || el.type === 'checkbox') el.disabled = !canEdit; else el.readOnly = !canEdit; });
    document.getElementById('add-attack-btn').style.display = canEdit ? 'block' : 'none'; document.getElementById('sync-btn').style.display = canEdit ? 'block' : 'none'; document.getElementById('delete-char-btn').style.display = canEdit ? 'block' : 'none';
    document.querySelectorAll('.read-only-hide').forEach(el => el.classList.toggle('hidden', !canEdit));
    document.getElementById('sheet-readonly-badge').classList.toggle('hidden', canEdit);
    
    // Notes Lock (DMs can see but cannot edit player notes)
    const canEditNotes = (currentUser && char.owner === currentUser.username) || (isDM && char.type !== 'PC');
    const floatingNotes = document.querySelector('#quick-notes-bar textarea[data-key="notes"]');
    if (floatingNotes) {
        floatingNotes.readOnly = !canEditNotes;
        if (!canEditNotes) {
            floatingNotes.classList.add('opacity-80', 'cursor-not-allowed');
            floatingNotes.placeholder = "No notes provided.";
        } else {
            floatingNotes.classList.remove('opacity-80', 'cursor-not-allowed');
            floatingNotes.placeholder = "Character history, secret notes...";
        }
    }

    /* PROGRESSION LOCKS */
    const dmUnlockCheck = document.getElementById('dm-unlock-sheet');
    if (dmUnlockCheck) dmUnlockCheck.checked = !!char.unlockedByDM;

    const isLockedProgression = !isDM && !char.unlockedByDM;

    const classInput = document.getElementById('class-input');
    const mClassBtn = document.getElementById('btn-multiclass');
    if (classInput) {
        if (canEdit) {
            classInput.disabled = false;
            classInput.readOnly = false;
            classInput.classList.remove('opacity-70', 'cursor-not-allowed');
            if (mClassBtn) mClassBtn.classList.remove('hidden');
        } else {
            classInput.readOnly = true;
            classInput.disabled = true;
            classInput.classList.add('opacity-70', 'cursor-not-allowed');
            if (mClassBtn) mClassBtn.classList.add('hidden');
        }
    }

    const rollGenBtn = document.getElementById('main-gen-btn');
    if (rollGenBtn) {
        if (char.scoresGenerated && isLockedProgression) {
            rollGenBtn.classList.add('hidden');
            STATS.forEach(s => {
                const el = document.querySelector(`[data-key="${s}"]`);
                if (el) { el.readOnly = true; el.classList.add('opacity-70', 'cursor-not-allowed', 'bg-transparent'); }
            });
        } else {
            if (canEdit) rollGenBtn.classList.remove('hidden');
            STATS.forEach(s => {
                const el = document.querySelector(`[data-key="${s}"]`);
                if (el && canEdit) { 
                    el.readOnly = false;
                    el.classList.remove('opacity-70', 'cursor-not-allowed'); 
                }
            });
        }
    }
    
    const dmPanel = document.getElementById('dm-oversight-panel');
    if (dmPanel) dmPanel.classList.toggle('hidden-view', !isDM);

    const claimBtn = document.getElementById('claim-char-btn'); 
    if (claimBtn) { if (!char.owner && currentUser && char.type !== 'NPC') claimBtn.classList.remove('hidden'); else claimBtn.classList.add('hidden'); }

    const typeBadge = document.getElementById('sheet-type-badge');
    if (typeBadge) {
        const isCompanion = char.type === 'BEAST' && char.visibility === 'private';
        typeBadge.textContent = isCompanion ? 'COMPANION' : (char.type || 'PC');
        typeBadge.className = char.type === 'NPC' ? 'bg-purple-900 border border-purple-700 text-parchment px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest' : 
                             (isCompanion ? 'bg-green-900 border border-green-700 text-parchment px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest' :
                             'bg-blood border border-gold text-parchment px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest');
    }

    const cl = document.getElementById('class-label');
    const nts = document.getElementById('npc-type-selectors');
    if (cl && nts) {
        if (char.type === 'NPC') {
            cl.textContent = 'Entity Type';
            nts.classList.remove('hidden');
        } else if (char.type === 'BEAST' && char.visibility === 'private') {
            cl.textContent = 'Companion Type';
            nts.classList.add('hidden');
        } else {
            cl.textContent = campaignSettings?.terms?.sheet_class || 'Class';
            nts.classList.add('hidden');
        }
    }
    
    document.querySelectorAll('[data-key]').forEach(el => { 
        if (el.type === 'checkbox') { el.checked = !!char[el.dataset.key]; } 
        else { const rawVal = char[el.dataset.key]; el.value = (rawVal !== undefined && rawVal !== null) ? rawVal : ""; }
    });
    
    const whispers = char.dmWhispers || [];
    const wl = document.getElementById('whispers-list');
    const wdb = document.getElementById('whisper-display-box');
    if (wl && wdb) {
        if (whispers.length > 0 || isDM) {
            wdb.classList.remove('hidden-view');
            wl.innerHTML = whispers.map((w, i) => `
                <div class="dm-whisper-box relative group shadow-sm">
                    <div class="flex justify-between items-start">
                        <span class="whisper-tag">DM SECRET</span>
                        ${isDM ? `<button onclick="window.deleteWhisper(${i})" class="text-blood hover:text-red-600 font-bold text-[12px] leading-none p-1">✕</button>` : ''}
                    </div>
                    <p class="text-sm italic font-serif text-black font-bold mt-1">${w.text}</p>
                </div>
            `).reverse().join('');
        } else { wdb.classList.add('hidden-view'); }
    }

    const dsBtn = document.getElementById('death-save-roll-btn');
    const saveLabel = document.getElementById('save-type-label');
    const comaActive = !!char.comaActive;
    if (dsBtn) dsBtn.textContent = comaActive ? "Roll Coma Save" : "Roll Death Save";
    if (saveLabel) saveLabel.textContent = comaActive ? "Coma Saves" : "Death Saves";

    for (let i = 1; i <= 3; i++) {
        const sDot = document.getElementById(`ds-succ-${i}`);
        const fDot = document.getElementById(`ds-fail-${i}`);
        if (sDot) sDot.className = `ds-dot ${(char.dsSucc || 0) >= i ? 'checked-succ' : ''}`;
        if (fDot) fDot.className = `ds-dot ${(char.dsFail || 0) >= i ? 'checked-fail' : ''}`;
    }

    const log = document.getElementById('dice-log'); if (log) { log.innerHTML = ''; (char.rollHistory || []).forEach(r => { const d = document.createElement('div'); d.className = "flex justify-between border-b border-dashed border-[rgba(139,90,43,0.3)] py-1.5 font-serif"; d.innerHTML = `<span class="text-555 font-bold italic">${r.label}</span><b class="text-blood">${r.total}</b>`; log.appendChild(d); }); }
    const pDisplay = document.getElementById('portrait-media-display');
    if (pDisplay) {
        if (char.imageSrc) { pDisplay.innerHTML = renderMedia(char.imageSrc, "w-full h-full object-cover rounded shadow-inner", char.status === 'dead' ? 'filter: grayscale(1)' : ''); document.getElementById('portrait-placeholder')?.classList.add('hidden'); } 
        else { pDisplay.innerHTML = ''; document.getElementById('portrait-placeholder')?.classList.remove('hidden'); }
    }
    const lc = document.getElementById('languages-list'); if (lc) { lc.innerHTML = ''; const langs = (char.languages || []); if (langs.length === 0) lc.innerHTML = '<span class="text-555 font-normal italic font-serif">None</span>'; else langs.forEach((l, idx) => { const d = document.createElement('div'); d.className = "flex items-center gap-1 font-serif text-ink"; const delBtn = canEdit ? `<button onclick="window.removeLanguageItem(${idx})" class="text-blood hover:text-red-800">×</button>` : ''; d.innerHTML = `<span>${l}${idx < langs.length - 1 ? ',' : ''}</span>${delBtn}`; lc.appendChild(d); }); }
    const ac = document.getElementById('attacks-list'); if (ac) { ac.innerHTML = ''; (char.attacks || []).forEach(a => { const d = document.createElement('div'); d.className = "equip-row"; const disabledAttr = !canEdit ? 'disabled' : ''; const delBtn = canEdit ? `<button onclick="this.parentElement.remove(); window.saveCurrentCharacter();" class="text-blood hover:text-red-800 font-black">✕</button>` : ''; d.innerHTML = `<input type="text" class="atk-name font-bold bg-transparent" value="${a.name}" ${disabledAttr}><input type="text" class="atk-bonus text-center bg-transparent" value="${a.bonus}" ${disabledAttr}><input type="text" class="atk-dmg text-center bg-transparent" value="${a.dmg}" ${disabledAttr}>${delBtn}`; ac.appendChild(d); }); }
    
    const compTab = document.getElementById('companion-view-area');
    if (compTab) {
        const classText = (char.class || '').toLowerCase();
        const aliases = window.getVocationAliases();
        const isArchivist = classText.includes(aliases['archivist']);
        const isNomad = classText.includes(aliases['nomad']);
        
        if (char.companionId) {
            const pet = characters.find(c => c.id === char.companionId && !c.isDeleted);
            if (pet) {
                let bondText = pet.bondLevel === 'bonded' ? 'Bonded Companion' : 'Connection Forming...';
                if (isArchivist && isNomad) bondText = 'Max Bond: Threaded Familiar & Beast Companion';
                else if (isArchivist) bondText = 'Max Bond: Threaded Familiar (Script Signature Linked)';
                else if (isNomad) bondText = 'Max Bond: Beast Companion (Lifelong Partner)';
                
                compTab.innerHTML = `
                    <div class="bg-transparent border-2 border-gold rounded p-6 text-center relative max-w-sm mx-auto mt-4">
                        ${pet.imageSrc ? `<img src="${pet.imageSrc}" class="w-24 h-24 mx-auto rounded-full object-cover border-4 border-gold mb-4 shadow-md">` : `<div class="w-24 h-24 mx-auto rounded-full bg-gray-300 flex items-center justify-center text-4xl border-4 border-gold mb-4 shadow-md">🐾</div>`}
                        <h4 class="text-2xl font-heading font-black text-blood uppercase tracking-widest mb-1">${pet.name}</h4>
                        <p class="text-[10px] text-555 uppercase font-bold tracking-widest mb-6 font-heading">${bondText}</p>
                        
                        <div class="flex justify-center gap-8 mb-8 bg-[rgba(255,255,255,0.4)] p-4 rounded border border-[rgba(139,90,43,0.3)] shadow-inner font-heading">
                            <div class="text-center"><span class="block text-[9px] font-bold text-555 uppercase tracking-widest mb-1">HP</span><span class="text-xl font-black ${pet.hpCurrent < (pet.hpMax/2) ? 'text-blood' : 'text-green-800'}">${pet.hpCurrent}/${pet.hpMax}</span></div>
                            <div class="text-center border-l border-r border-[rgba(139,90,43,0.3)] px-8"><span class="block text-[9px] font-bold text-555 uppercase tracking-widest mb-1">AC</span><span class="text-xl font-black text-ink">${pet.ac || 10}</span></div>
                        </div>
                        <p class="text-xs text-ink italic font-serif mb-4">Visit Companions Dashboard to manage tracking and interactions.</p>
                        <button onclick="try { window.routeTo ? window.routeTo('companions.html') : window.location.href='companions.html' } catch(e) { window.showToast('Redirects disabled in preview window.') }" class="fantasy-btn px-6 py-2 rounded text-[10px] font-bold uppercase tracking-widest">Manage Companions</button>
                    </div>
                `;
            } else {
                compTab.innerHTML = `<div class="text-center py-12 font-heading"><p class="text-blood font-bold mb-4 text-xs uppercase tracking-widest">Companion missing or deleted.</p><button onclick="try { window.routeTo ? window.routeTo('companions.html') : window.location.href='companions.html' } catch(e) { window.showToast('Redirects disabled in preview window.') }" class="fantasy-btn px-6 py-2 rounded text-[10px] font-bold uppercase tracking-widest mt-2">View Companions</button></div>`;
            }
        } else {
            let emptyTitle = "No Companion Linked";
            let emptyDesc = "You travel alone. Head to the Companions menu to adopt.";
            
            if (isArchivist && isNomad) {
                emptyTitle = "No Familiar or Beast Linked";
                emptyDesc = "As an Archivist/Nomad, you gain max friendship instantly with your first companion. You can form a THREADED FAMILIAR or bond with a real beast. Head to the Companions menu.";
            } else if (isArchivist) {
                emptyTitle = "No Threaded Familiar";
                emptyDesc = "As an Archivist, your first companion gains max friendship instantly. You can initiate a bonded companion Concord sequence, forming a persistent autonomous support entity linked to your Script signature (bat, cat, crab, frog, hawk, lizard, octopus, owl, snake, fish, rat, raven, sea horse, spider, or weasel). Head to Companions to manifest it.";
            } else if (isNomad) {
                emptyTitle = "No Beast Companion";
                emptyDesc = "As a Nomad, your first companion gains max friendship instantly. You can bond with a real beast (like a wolf, bear, panther, or hawk) that fights beside you in combat and grows stronger with your levels. Head to Companions to find them.";
            }

            compTab.innerHTML = `
                <div class="text-center py-16 border border-dashed border-gold rounded bg-[rgba(255,255,255,0.2)] max-w-lg mx-auto mt-4 font-heading">
                    <div class="text-5xl mb-4 grayscale opacity-50">🐾</div>
                    <h4 class="text-sm font-bold text-ink uppercase tracking-[0.2em] mb-2">${emptyTitle}</h4>
                    <p class="text-xs text-555 mb-6 max-w-xs mx-auto font-serif italic">${emptyDesc}</p>
                    <button onclick="try { window.routeTo ? window.routeTo('companions.html') : window.location.href='companions.html' } catch(e) { window.showToast('Redirects disabled in preview window.') }" class="fantasy-btn px-6 py-2 rounded text-[10px] font-bold uppercase tracking-widest">Find a Companion</button>
                </div>
            `;
        }
    }
    window.calcMods(); window.renderMovesGrid(); window.updateClassSpecifics();
}

window.sendDmWhisper = async () => {
    const input = document.getElementById('dm-whisper-input');
    if (!input || !input.value.trim() || !activeCharId || activeRole !== 'dm') return;
    const char = characters.find(c => c.id === activeCharId); if (!char) return;
    const whispers = [...(char.dmWhispers || [])]; whispers.push({ text: input.value.trim(), timestamp: Date.now() });
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), { dmWhispers: whispers });
    input.value = ''; window.showToast("Whisper Sent");
};

window.deleteWhisper = async (idx) => {
    if (!activeCharId || activeRole !== 'dm') return;
    const char = characters.find(c => c.id === activeCharId); if (!char) return;
    const whispers = [...(char.dmWhispers || [])]; whispers.splice(idx, 1);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), { dmWhispers: whispers });
    window.showToast("Whisper Removed");
};

window.openHpAdjustmentModal = () => { document.getElementById('hp-adjust-amount').value = ''; document.getElementById('hp-adjustment-modal').classList.remove('hidden'); document.getElementById('hp-adjust-amount').focus(); };

window.applyHpAdjustment = async (type) => {
    const amtIn = document.getElementById('hp-adjust-amount'); const amount = parseInt(amtIn.value); if (isNaN(amount) || amount <= 0) { amtIn.focus(); return; }
    const char = characters.find(c => c.id === activeCharId); if (!char) return;
    let curHp = parseInt(char.hpCurrent) || 0, maxHp = parseInt(char.hpMax) || 1, tempHp = parseInt(char.tempHp) || 0, updates = {};
    
    if (type === 'dmg') { 
        let remainingDmg = amount; 
        if (tempHp > 0) { 
            const absorbed = Math.min(tempHp, remainingDmg); 
            tempHp -= absorbed; remainingDmg -= absorbed; 
            updates.tempHp = tempHp; 
        } 
        if (remainingDmg > 0) { 
            curHp = Math.max(0, curHp - remainingDmg); 
            updates.hpCurrent = curHp; 
            if (curHp === 0 && (parseInt(char.hpCurrent) || 0) > 0) {
                updates.status = 'coma';
                updates.comaActive = true;
                window.showToast(`Critical Damage! ${char.name} has fallen unconscious!`);
            } else {
                window.showToast(`Took ${amount} Damage`); 
            }
        } else {
            window.showToast(`Took ${amount} Damage (Absorbed by Temp HP)`);
        }
    } 
    else if (type === 'heal') { 
        curHp = Math.min(maxHp, curHp + amount); 
        updates.hpCurrent = curHp; 
        if (curHp > 0 && ((parseInt(char.hpCurrent) || 0) <= 0 || char.status === 'coma')) {
            updates.status = 'alive';
            updates.comaActive = false;
            window.showToast(`Healed ${amount} HP. Awakened!`);
        } else {
            window.showToast(`Healed ${amount} HP`); 
        }
    }
    
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), updates); 
    document.getElementById('hp-adjustment-modal').classList.add('hidden');
};

window.openScoreGenModal = () => { sessionRerollUsed = false; document.getElementById('score-gen-modal')?.classList.remove('hidden'); document.getElementById('gen-results-area')?.classList.add('hidden'); document.getElementById('gen-apply-area')?.classList.add('hidden'); document.getElementById('gen-controls')?.classList.remove('hidden'); };
window.generateScores = (method, isReroll = false) => { 
    if (method === 'standard') lastGeneratedScores = [15, 14, 13, 12, 10, 8]; 
    else { if (isReroll) sessionRerollUsed = true; lastGeneratedScores = Array.from({length: 6}, () => { const r = [getRoll(6), getRoll(6), getRoll(6), getRoll(6)]; r.sort((a,b)=>b-a); return r[0]+r[1]+r[2]; }).sort((a,b)=>b-a); } 
    document.getElementById('gen-numbers-display').innerHTML = lastGeneratedScores.map(n => `<span class="score-line-val font-black mx-2 text-2xl text-ink font-serif">${n}</span>`).join(''); 
    document.getElementById('assign-grid').innerHTML = STATS.map(s => `<div class="bg-[rgba(255,255,255,0.4)] p-2 px-3 rounded flex justify-between items-center border border-gold"><span class="font-bold text-[10px] uppercase text-555 font-heading">${s}</span><select data-assign-stat="${s}" class="text-xs font-bold border-none bg-transparent focus:ring-0 text-ink"><option value="">-</option>${lastGeneratedScores.map((n, i) => `<option value="${i}">${n}</option>`).join('')}</select></div>`).join(''); 
    document.getElementById('gen-results-area')?.classList.remove('hidden'); document.getElementById('gen-apply-area')?.classList.remove('hidden'); document.getElementById('gen-controls')?.classList.add('hidden'); document.getElementById('heroic-reroll-area')?.classList.toggle('hidden', method !== 'heroic' || sessionRerollUsed); 
};

window.randomizeAssignment = () => { const p = [0,1,2,3,4,5].sort(()=>Math.random()-0.5); Array.from(document.querySelectorAll('[data-assign-stat]')).forEach((s,i)=>s.value=p[i]); };
window.applyScores = async () => { 
    const selects = Array.from(document.querySelectorAll('[data-assign-stat]')); const chosen = selects.map(s => s.value).filter(v => v !== ""); if (chosen.length < 6 || new Set(chosen).size < 6) return window.showToast("Assign unique values to all stats"); 
    const updates = { scoresGenerated: true }; selects.forEach(s => updates[s.dataset.assignStat] = lastGeneratedScores[parseInt(s.value)]); 
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), updates); document.getElementById('score-gen-modal')?.classList.add('hidden'); window.calcMods(); 
};

const addRollToHistory = async (label, total) => {
    if (!activeCharId) return; 
    const char = characters.find(c => c.id === activeCharId); if (!char) return;
    const log = document.getElementById('dice-log'); if (log) { 
        const d = document.createElement('div'); d.className = "flex justify-between border-b border-dashed border-[rgba(139,90,43,0.3)] py-1.5 font-serif"; 
        d.innerHTML = `<span class="text-555 font-bold italic">${label}</span><b class="text-blood">${total}</b>`; 
        log.prepend(d); if (log.children.length > 20) log.lastElementChild.remove(); 
    }
    const history = [{ label, total, timestamp: Date.now() }, ...(char.rollHistory || [])].slice(0, 20); 
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), { rollHistory: history });
};

function execRoll(label, bonus) { 
    const r1 = getRoll(20), r2 = getRoll(20); 
    let final, btxt; if (rollMode === 'adv') { final = Math.max(r1, r2); btxt = `Adv: High(${r1}, ${r2})`; } else if (rollMode === 'dis') { final = Math.min(r1, r2); btxt = `Dis: Low(${r1}, ${r2})`; } else { final = r1; btxt = `(${r1})`; } 
    
    if (final === 1) triggerCriticalFailure(); 
    if (final === 20) triggerCriticalSuccess();
    
    const total = final + bonus; const displayTotal = (total >= 0 ? '+' : '') + total;
    document.getElementById('roll-label').textContent = label; document.getElementById('roll-total').textContent = displayTotal; 
    document.getElementById('roll-breakdown').textContent = `${btxt} + ${bonus}`; 
    document.getElementById('dice-result-overlay').classList.remove('hidden'); 
    addRollToHistory(label, displayTotal + ` (Natural ${final})`); 
}

window.rollStat = (s) => execRoll(`${s.toUpperCase()} Check`, parseInt(document.getElementById(`mod-${s}`)?.textContent) || 0);
window.rollSave = (s) => execRoll(`${s.toUpperCase()} Save`, parseInt(document.getElementById(`save-mod-${s}`)?.textContent) || 0);
window.rollSkill = (n) => execRoll(`${n} Check`, parseInt(document.getElementById(`skill-mod-${n.toLowerCase().replace(/ /g,'_').replace(/[()]/g,'')}`)?.textContent) || 0);

window.rollDice = (s) => { 
    const count = parseInt(document.getElementById('roll-count').value) || 1; let label, total, breakdown; 
    if (count === 1 && rollMode !== 'normal') { 
        const r1 = getRoll(s), r2 = getRoll(s); let final = rollMode === 'adv' ? Math.max(r1, r2) : Math.min(r1, r2);
        if (s === 20) { if (final === 1) triggerCriticalFailure(); if (final === 20) triggerCriticalSuccess(); }
        total = final; label = `d${s} Roll`; breakdown = `${rollMode.toUpperCase()}: (${r1}, ${r2})`;
    } else { 
        const rolls = Array.from({length: count}, () => getRoll(s)); 
        if (count === 1 && s === 20) { if (rolls[0] === 1) triggerCriticalFailure(); if (rolls[0] === 20) triggerCriticalSuccess(); }
        total = rolls.reduce((a, b) => a + b, 0); label = `${count}d${s} Roll`; breakdown = count > 1 ? `${rolls.join(' + ')} = ${total}` : `(${rolls[0]})`; 
    } 
    document.getElementById('roll-label').textContent = label; document.getElementById('roll-total').textContent = total; document.getElementById('roll-breakdown').textContent = breakdown; document.getElementById('dice-result-overlay').classList.remove('hidden'); addRollToHistory(label, total); 
};

window.setRollMode = (m) => { rollMode = m; document.querySelectorAll('.roll-mode').forEach(b => b.classList.remove('active-norm', 'active-adv', 'active-dis')); if (m === 'normal') document.getElementById('mode-norm').classList.add('active-norm'); else if (m === 'adv') document.getElementById('mode-adv').classList.add('active-adv'); else if (m === 'dis') document.getElementById('mode-dis').classList.add('active-dis'); };

window.toggleNotes = (minimize) => {
    const notesBar = document.getElementById('quick-notes-bar');
    const exp = document.getElementById('notes-expanded-view');
    const min = document.getElementById('notes-minimized-view');
    if (minimize) {
        notesBar.classList.add('minimized');
        exp.classList.add('hidden');
        min.classList.remove('hidden');
    } else {
        notesBar.classList.remove('minimized');
        exp.classList.remove('hidden');
        min.classList.add('hidden');
    }
};

window.toggleRoller = (minimize) => {
    const roller = document.getElementById('quick-roll-bar');
    const exp = document.getElementById('roller-expanded-view');
    const min = document.getElementById('roller-minimized-view');
    if (minimize) {
        roller.classList.add('minimized');
        exp.classList.add('hidden');
        min.classList.remove('hidden');
    } else {
        roller.classList.remove('minimized');
        exp.classList.remove('hidden');
        min.classList.add('hidden');
    }
};

window.renderMovesGrid = () => { 
    const s = document.getElementById('moves-selector'); if (!s) return; 
    const t = s.value, g = document.getElementById('features-lvl-grid'); if (!g) return; 
    g.innerHTML = '';
    
    const char = characters.find(c => c.id === activeCharId); 
    const moves = char?.moves || []; 
    let levels = [];
    
    if (t === 'features') {
        levels = Array.from({length: 20}, (_, i) => `Level ${i + 1}`);
    } else {
        let classes = char?.classes || [];
        if (classes.length === 0 && char?.class) {
            classes = [{name: char.class}];
        }
        
        let maxScriptLevel = -1; 
        let hasTrickCaster = false;
        const aliases = window.getVocationAliases();

        classes.forEach(clsObj => {
            const cName = (clsObj.name || '').toLowerCase();
            if (['warden', 'chronicler', 'orator', 'scriptweaver', 'wartouched', 'archivist'].some(vc => cName.includes(aliases[vc]))) {
                maxScriptLevel = Math.max(maxScriptLevel, 9);
                hasTrickCaster = true;
            } else if (cName.includes(aliases['fabricator'])) {
                maxScriptLevel = Math.max(maxScriptLevel, 5);
                hasTrickCaster = true;
            } else if (['heartbound', 'nomad'].some(vc => cName.includes(aliases[vc]))) {
                maxScriptLevel = Math.max(maxScriptLevel, 5);
            }
        });

        if (maxScriptLevel === -1) {
            g.innerHTML = '<div class="col-span-full text-center py-8 text-555 font-heading text-xs uppercase tracking-widest border border-dashed border-gold rounded bg-[rgba(255,255,255,0.2)]">This vocation does not utilize scripts.</div>';
            return;
        } else {
            if (hasTrickCaster) levels.push('Tricks (0)');
            for(let i = 1; i <= maxScriptLevel; i++) {
                levels.push(`Level ${i}`);
            }
        }
    }

    const canEdit = (currentUser && char?.owner === currentUser?.username) || char?.owner === 'DM' || activeRole === 'dm';
    levels.forEach(lvl => { 
        const card = document.createElement('div'); card.className = "lvl-card"; const filtered = moves.filter(m => m.lvl === lvl && m.type === t); let html = `<div class="lvl-header">${lvl.toUpperCase()}</div><div class="flex-grow space-y-1">`;
        filtered.forEach(m => { const mIdx = moves.indexOf(m); html += `<div class="move-pill" ${canEdit ? `onclick="window.openMoveModal('${lvl}', ${mIdx})"` : ''}><span class="move-name">${m.name}</span><span class="move-roll">${m.roll || ''}</span></div>`; });
        if (canEdit) html += `</div><button onclick="window.openMoveModal('${lvl}')" class="text-[9px] font-bold uppercase text-blood hover:text-ink text-center mt-2 font-heading transition-colors">+ ADD</button>`; else html += `</div>`;
        card.innerHTML = html; g.appendChild(card);
    }); 
};

window.openMoveModal = (lvl, idx = null) => { 
    activeMoveLvl = lvl; editingMoveIndex = idx; const char = characters.find(c => c.id === activeCharId); const moves = char?.moves || [];
    const moveType = document.getElementById('moves-selector').value;
    const isScript = moveType === 'scriptcasting';
    document.getElementById('move-import-btn').classList.remove('hidden');
    document.getElementById('script-extra-fields').classList.toggle('hidden', !isScript);
    document.getElementById('script-scaling-field').classList.toggle('hidden', !isScript);
    document.getElementById('move-desc-label').textContent = isScript ? "Effect" : "Description";
    document.getElementById('import-view').classList.add('hidden');
    document.getElementById('modal-standard-view').classList.remove('hidden');
    const hint = isScript ? "Paste Script Data (NAME, SCHOOL, EFFECT, etc):" : "Paste Move/Feature Data (NAME, DESCRIPTION):";
    document.getElementById('import-hint-text').textContent = hint;
    if (idx !== null) { 
        const m = moves[idx]; 
        document.getElementById('move-name-in').value = m.name || ''; 
        document.getElementById('move-roll-in').value = m.roll || ''; 
        document.getElementById('move-desc-in').value = m.desc || ''; 
        document.getElementById('script-lvl-in').value = lvl;
        document.getElementById('script-school-in').value = m.school || '';
        document.getElementById('script-type-in').value = m.sType || '';
        document.getElementById('script-activation-in').value = m.activation || '';
        document.getElementById('script-range-in').value = m.range || '';
        document.getElementById('script-comp-in').value = m.comp || '';
        document.getElementById('script-duration-in').value = m.duration || '';
        document.getElementById('script-scaling-in').value = m.scaling || '';
        document.getElementById('move-modal-title').textContent = "Edit " + (isScript ? "Script" : "Move"); 
        document.getElementById('move-delete-btn').classList.remove('hidden'); 
    } else { 
        document.getElementById('move-name-in').value = ''; 
        document.getElementById('move-roll-in').value = ''; 
        document.getElementById('move-desc-in').value = ''; 
        document.getElementById('script-lvl-in').value = lvl;
        document.getElementById('script-school-in').value = '';
        document.getElementById('script-type-in').value = '';
        document.getElementById('script-activation-in').value = '';
        document.getElementById('script-range-in').value = '';
        document.getElementById('script-comp-in').value = '';
        document.getElementById('script-duration-in').value = '';
        document.getElementById('script-scaling-in').value = '';
        document.getElementById('move-modal-title').textContent = "Add " + (isScript ? "Script" : "Move") + " - " + lvl; 
        document.getElementById('move-delete-btn').classList.add('hidden'); 
    }
    document.getElementById('move-modal').classList.remove('hidden'); 
};

window.toggleImportView = () => {
    const importView = document.getElementById('import-view');
    const standardView = document.getElementById('modal-standard-view');
    const isImportHidden = importView.classList.contains('hidden');
    importView.classList.toggle('hidden', !isImportHidden);
    standardView.classList.toggle('hidden', isImportHidden);
    if (isImportHidden) {
        document.getElementById('import-paste-area').value = '';
        document.getElementById('import-paste-area').focus();
    }
};

window.executeMoveImport = () => {
    const rawText = document.getElementById('import-paste-area').value;
    if (!rawText.trim()) return;
    const moveType = document.getElementById('moves-selector').value;
    const isScript = moveType === 'scriptcasting';
    const extract = (regex) => {
        const match = rawText.match(regex);
        return match ? match[1].trim() : "";
    };
    const extractBlock = (startKey, endKeys) => {
        const startIdx = rawText.indexOf(startKey);
        if (startIdx === -1) return "";
        const afterStart = rawText.substring(startIdx + startKey.length);
        let firstEndIdx = afterStart.length;
        endKeys.forEach(ek => {
            const idx = afterStart.indexOf(ek);
            if (idx !== -1 && idx < firstEndIdx) firstEndIdx = idx;
        });
        return afterStart.substring(0, firstEndIdx).trim();
    };
    const name = extract(/NAME:\s*(.*)/i) || extract(/\(The Name\)\s*(.*)/i);
    const roll = extract(/DICE\/EFFECT ROLL:\s*(.*)/i) || extract(/ROLL:\s*(.*)/i);
    if (isScript) {
        const school = extract(/SCHOOL:\s*(.*)/i);
        const type = extract(/TYPE:\s*(.*)/i);
        const activation = extract(/ACTIVATION:\s*(.*)/i);
        const range = extract(/RANGE:\s*(.*)/i);
        const comp = extract(/COMPONENTS:\s*(.*)/i);
        const duration = extract(/DURATION:\s*(.*)/i);
        const effect = extractBlock("EFFECT:", ["SCALING:", "AUTHORIZED USERS:"]);
        const scaling = extractBlock("SCALING:", ["AUTHORIZED USERS:"]);
        if (name) document.getElementById('move-name-in').value = name;
        if (roll) document.getElementById('move-roll-in').value = roll;
        if (school) document.getElementById('script-school-in').value = school;
        if (type) document.getElementById('script-type-in').value = type;
        if (activation) document.getElementById('script-activation-in').value = activation;
        if (range) document.getElementById('script-range-in').value = range;
        if (comp) document.getElementById('script-comp-in').value = comp;
        if (duration) document.getElementById('script-duration-in').value = duration;
        if (effect) document.getElementById('move-desc-in').value = effect;
        if (scaling) document.getElementById('script-scaling-in').value = scaling;
    } else {
        const desc = extractBlock("DESCRIPTION:", []) || extractBlock("(The Description)", []);
        if (name) document.getElementById('move-name-in').value = name;
        if (roll) document.getElementById('move-roll-in').value = roll;
        if (desc) document.getElementById('move-desc-in').value = desc;
    }
    window.toggleImportView();
    window.showToast("Move Parsed Successfully");
};

window.saveMove = async () => { 
    const char = characters.find(c => c.id === activeCharId); 
    const moves = char.moves || []; 
    const newMove = { 
        name: document.getElementById('move-name-in').value, 
        roll: document.getElementById('move-roll-in').value, 
        desc: document.getElementById('move-desc-in').value, 
        lvl: activeMoveLvl, 
        type: document.getElementById('moves-selector').value,
        school: document.getElementById('script-school-in').value,
        sType: document.getElementById('script-type-in').value,
        activation: document.getElementById('script-activation-in').value,
        range: document.getElementById('script-range-in').value,
        comp: document.getElementById('script-comp-in').value,
        duration: document.getElementById('script-duration-in').value,
        scaling: document.getElementById('script-scaling-in').value
    }; 
    if (editingMoveIndex !== null) moves[editingMoveIndex] = newMove; 
    else moves.push(newMove); 
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), { moves }); 
    document.getElementById('move-modal').classList.add('hidden'); 
};
window.deleteMove = async () => { const char = characters.find(c => c.id === activeCharId); const moves = char.moves || []; moves.splice(editingMoveIndex, 1); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), { moves }); document.getElementById('move-modal').classList.add('hidden'); };

window.openMulticlassModal = () => {
    const char = characters.find(c => c.id === activeCharId);
    if (!char) return;
    
    let classes = char.classes || [];
    if (classes.length === 0) {
        classes = [{name: char.class || '', level: parseInt(char.level) || 1}];
    }
    
    const list = document.getElementById('multiclass-list');
    list.innerHTML = '';
    classes.forEach(c => {
        window.appendMulticlassRow(c.name, c.level);
    });
    
    document.getElementById('multiclass-modal').classList.remove('hidden');
};

window.appendMulticlassRow = (name = '', level = 1) => {
    const list = document.getElementById('multiclass-list');
    const div = document.createElement('div');
    div.className = "flex gap-2 items-center mc-row";
    div.innerHTML = `
        <input type="text" class="mc-name flex-grow bg-[rgba(255,255,255,0.5)] border border-gold p-2 rounded font-bold font-serif text-ink" placeholder="Vocation Name" value="${name}">
        <input type="number" class="mc-level w-20 bg-[rgba(255,255,255,0.5)] border border-gold p-2 rounded font-bold text-center text-ink" placeholder="Lvl" value="${level}" min="1">
        <button onclick="this.parentElement.remove()" class="text-blood hover:text-red-800 font-black px-2 transition-colors">✕</button>
    `;
    list.appendChild(div);
};

window.addMulticlassRow = () => {
    window.appendMulticlassRow('', 1);
};

window.saveMulticlass = async () => {
    const char = characters.find(c => c.id === activeCharId);
    if (!char) return;
    
    const rows = document.querySelectorAll('.mc-row');
    let classes = [];
    let totalLevel = 0;
    let classStringParts = [];
    
    rows.forEach(r => {
        const name = r.querySelector('.mc-name').value.trim();
        const level = parseInt(r.querySelector('.mc-level').value) || 1;
        if (name) {
            classes.push({name, level});
            totalLevel += level;
            classStringParts.push(`${name} ${level}`);
        }
    });
    
    if (classes.length === 0) {
        window.showToast("Must have at least one vocation.");
        return;
    }
    
    const newClassString = classStringParts.join(' / ');
    
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), { 
        classes: classes,
        class: newClassString,
        level: totalLevel
    });
    
    document.getElementById('multiclass-modal').classList.add('hidden');
    window.updateLevelDependencies(totalLevel);
    window.showToast("Vocations Updated");
};

window.saveCurrentCharacter = (m) => { 
    if (!activeCharId || !currentUser) return; 
    const char = characters.find(c => c.id === activeCharId); 
    if (!((currentUser && char.owner === currentUser.username) || char.owner === 'DM' || activeRole === 'dm')) return; 
    
    const data = {}; 
    document.querySelectorAll('[data-key]').forEach(el => data[el.dataset.key] = el.type === 'checkbox' ? el.checked : el.value); 
    
    const newHp = parseInt(data.hpCurrent) || 0;
    const oldHp = parseInt(char.hpCurrent) || 0;
    
    if (newHp <= 0 && oldHp > 0) {
        data.hpCurrent = 0; 
        data.status = 'coma';
        data.comaActive = true;
        window.showToast("Health depleted. Coma saves initiated.");
    } else if (newHp > 0 && (oldHp <= 0 || char.status === 'coma')) {
        data.status = 'alive';
        data.comaActive = false;
        window.showToast("Vitality restored. Awakened from coma.");
    }

    data.languages = char.languages || []; 
    data.attacks = Array.from(document.querySelectorAll('#attacks-list > div')).map(r => ({ name: r.querySelector('.atk-name')?.value || "", bonus: r.querySelector('.atk-bonus')?.value || "", dmg: r.querySelector('.atk-dmg')?.value || "" })); 
    data.moves = char.moves || []; 
    
    updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), data); 
    
    if (m) window.showToast("Synced"); 
    const si = document.getElementById('sync-indicator'); 
    if (si) { si.style.opacity = 1; setTimeout(()=>si.style.opacity = 0, 1000); } 
};

window.claimCharacter = async () => { const char = characters.find(c => c.id === activeCharId); if (char.owner) return; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), { owner: currentUser.username }); window.showToast("Character Claimed"); };

window.calcMods = () => { 
    const p = parseInt(document.querySelector('[data-key="profBonus"]')?.value) || 2; 
    let stats = {};
    STATS.forEach(s => { 
        const v = parseInt(document.querySelector(`[data-key="${s}"]`)?.value) || 10; const m = Math.floor((v - 10) / 2); 
        stats[s] = {val: v, mod: m};
        const el = document.getElementById(`mod-${s}`); if(el) el.textContent = (m >= 0 ? '+' : '') + m; 
        const sp = document.querySelector(`[data-key="save_prof_${s}"]`)?.checked; const sel = document.getElementById(`save-mod-${s}`); if(sel) sel.textContent = (m + (sp ? p : 0) >= 0 ? '+' : '') + (m + (sp ? p : 0)); 
    }); 
    const ppInput = document.querySelector('[data-key="passivePerception"]'); if (ppInput) ppInput.value = 10 + stats.wis.mod + p;
    SKILLS.forEach(sk => { 
        const v = parseInt(document.querySelector(`[data-key="${sk.s}"]`)?.value) || 10; const m = Math.floor((v - 10) / 2); 
        const safe = sk.n.toLowerCase().replace(/ /g,'_').replace(/[()]/g,''); const sp = document.querySelector(`[data-key="prof_${safe}"]`)?.checked; 
        const sel = document.getElementById(`skill-mod-${safe}`); if(sel) sel.textContent = (m + (sp ? p : 0) >= 0 ? '+' : '') + (m + (sp ? p : 0)); 
    });
    const armorText = (document.querySelector('[data-key="profArmor"]')?.value || "").toLowerCase();
    const classText = (document.querySelector('[data-key="class"]')?.value || "").toLowerCase();
    const aliases = window.getVocationAliases();
    const acInput = document.querySelector('[data-key="ac"]');
    if (acInput) {
        let baseAC = 10;
        let dexBonus = stats.dex.mod;
        let shieldBonus = armorText.includes('shield') ? 2 : 0;
        let wearingArmor = false;
        if (armorText.includes('light armor')) { baseAC = 11; dexBonus = stats.dex.mod; wearingArmor = true; }
        else if (armorText.includes('medium armor')) { baseAC = 14; dexBonus = Math.min(stats.dex.mod, 2); wearingArmor = true; }
        else if (armorText.includes('heavy armor')) { baseAC = 16; dexBonus = 0; wearingArmor = true; }
        if (!wearingArmor) {
            if (classText.includes(aliases['vanguard'])) { baseAC = 10 + stats.con.mod; dexBonus = stats.dex.mod; }
            else if (classText.includes(aliases['peacekeeper'])) { baseAC = 10 + stats.wis.mod; dexBonus = stats.dex.mod; }
            else { baseAC = 10; dexBonus = stats.dex.mod; }
        }
        acInput.value = baseAC + dexBonus + shieldBonus;
    }

    if (activeCharId) {
        window.autoCalcHP(false); 
    }
};

window.updateCharStatus = async (s) => { if (!activeCharId) return; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), { status: s }); };
window.toggleSheetUnlock = async (val) => { if (!activeCharId || activeRole !== 'dm') return; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), { unlockedByDM: val }); window.showToast(val ? "Progression Unlocked for Player" : "Progression Locked"); };
window.addAttackItem = () => { const c = document.getElementById('attacks-list'); const d = document.createElement('div'); d.className = "equip-row"; d.innerHTML = `<input type="text" class="atk-name font-bold bg-transparent" placeholder="Weapon"><input type="text" class="atk-bonus text-center bg-transparent" placeholder="+0"><input type="text" class="atk-dmg text-center bg-transparent" placeholder="1d8"><button onclick="this.parentElement.remove(); window.saveCurrentCharacter();" class="text-blood hover:text-red-800 font-black">✕</button>`; c.appendChild(d); };
window.addLanguageItem = async () => { const i = document.getElementById('lang-input'); if (!i.value) return; const char = characters.find(c => c.id === activeCharId); const langs = [...(char.languages || []), i.value]; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), { languages: langs }); i.value = ''; };
window.removeLanguageItem = async (idx) => { const char = characters.find(c => c.id === activeCharId); const langs = [...(char.languages || [])]; langs.splice(idx, 1); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), { languages: langs }); };
window.updateLevelDependencies = (v) => { 
    const l = parseInt(v) || 1; 
    const b = l >= 17 ? 6 : l >= 13 ? 5 : l >= 9 ? 4 : l >= 5 ? 3 : 2; 
    const pi = document.querySelector('[data-key="profBonus"]'); 
    if (pi) pi.value = b; 
    window.calcMods(); 
    window.saveCurrentCharacter(); 
};

window.rest = async (t) => { 
    const char = characters.find(x => x.id === activeCharId); 
    if (t === 'long') { 
        const maxHd = parseInt(char.level) || 1;
        const currentHd = parseInt(char.hdCurrent) || 0;
        const regain = Math.max(1, Math.floor(maxHd / 2));
        const newHd = Math.min(maxHd, currentHd + regain);
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), { hpCurrent: char.hpMax, tempHp: 0, dsSucc: 0, dsFail: 0, hdCurrent: newHd }); 
        window.showToast("Long Rest: Recovered HP & " + regain + " HD"); 
    } 
    else { 
        const conMod = Math.floor(((char.con || 10) - 10) / 2); 
        const hdText = char.hd || "1d8";
        const dieMatch = hdText.match(/d(\d+)/);
        const dieType = dieMatch ? dieMatch[1] : "8";
        document.getElementById('sr-con-mod-display').textContent = (conMod >= 0 ? '+' : '') + conMod; 
        document.getElementById('sr-con-mod-display').dataset.mod = conMod; 
        document.getElementById('sr-hd-available').textContent = (char.hdCurrent || 0) + " / " + (char.level || 1);
        document.getElementById('sr-die-type-label').textContent = "d" + dieType;
        document.getElementById('sr-roll-result-area').classList.add('hidden');
        const spendBtn = document.getElementById('sr-spend-btn');
        if ((char.hdCurrent || 0) <= 0) { spendBtn.disabled = true; spendBtn.classList.add('opacity-50', 'cursor-not-allowed'); spendBtn.textContent = "No Hit Dice Left"; } 
        else { spendBtn.disabled = false; spendBtn.classList.remove('opacity-50', 'cursor-not-allowed'); spendBtn.textContent = "Roll 1 Hit Die (d" + dieType + ")"; }
        document.getElementById('short-rest-modal').classList.remove('hidden'); 
    }
};

window.confirmShortRest = async () => { 
    const char = characters.find(x => x.id === activeCharId);
    if (!char || (char.hdCurrent || 0) <= 0) return;
    const hdText = char.hd || "1d8";
    const dieMatch = hdText.match(/d(\d+)/);
    const dieSize = dieMatch ? parseInt(dieMatch[1]) : 8;
    const conMod = parseInt(document.getElementById('sr-con-mod-display').dataset.mod) || 0; 
    const roll = getRoll(dieSize);
    const gain = Math.max(0, roll + conMod);
    const newHp = Math.min(parseInt(char.hpMax) || gain, (parseInt(char.hpCurrent) || 0) + gain);
    const newHdCount = (char.hdCurrent || 0) - 1;
    document.getElementById('sr-roll-result-area').classList.remove('hidden');
    document.getElementById('sr-last-roll-total').textContent = "+" + gain + " HP";
    document.getElementById('sr-last-roll-breakdown').textContent = "(" + roll + " + " + conMod + ")";
    document.getElementById('sr-hd-available').textContent = newHdCount + " / " + (char.level || 1);
    const spendBtn = document.getElementById('sr-spend-btn');
    if (newHdCount <= 0) { spendBtn.disabled = true; spendBtn.classList.add('opacity-50', 'cursor-not-allowed'); spendBtn.textContent = "No Hit Dice Left"; }
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), { hpCurrent: newHp, hdCurrent: newHdCount });
    addRollToHistory(`Spent Hit Die (d${dieSize})`, `+${gain} HP`);
};

window.toggleDS = async (type, num) => {
    const char = characters.find(c => c.id === activeCharId); if (!char) return;
    const isOwner = (currentUser && char.owner === currentUser.username) || char.owner === 'DM';
    const isDM = activeRole === 'dm'; if (!isOwner && !isDM) return;
    const key = type === 'succ' ? 'dsSucc' : 'dsFail';
    const newVal = (char[key] || 0) === num ? num - 1 : num;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), { [key]: newVal });
};

window.rollDeathSave = async () => {
    const char = characters.find(c => c.id === activeCharId); if (!char || char.status === 'dead' || (char.status === 'coma' && !char.comaActive) || char.hpCurrent > 0) return;
    const roll = getRoll(20);
    let s = char.dsSucc || 0, f = char.dsFail || 0, updates = {}, msg = "";
    const isComa = !!char.comaActive;
    if (isComa) {
        if (roll === 20) { updates = { hpCurrent: 1, dsSucc: 0, dsFail: 0, comaActive: false, status: 'alive', exhaustion: (parseInt(char.exhaustion) || 0) + 1 }; msg = "NATURAL 20! Awakening (HP 1, Exhaustion +1)."; triggerCriticalSuccess(); } 
        else if (roll === 1) { f += 2; updates.currentStress = (parseInt(char.currentStress) || 0) + 1; const comp = COMA_COMPLICATIONS[Math.floor(Math.random() * COMA_COMPLICATIONS.length)]; msg = "NATURAL 1! +1 Stress, 2 Failures & Complication: " + comp; triggerCriticalFailure(); } 
        else if (roll >= 12) { s += 1; msg = "Coma Success (" + roll + ")"; } 
        else { f += 1; msg = "Coma Failure (" + roll + ")"; }
        if (s >= 3) { updates = { hpCurrent: 1, dsSucc: 0, dsFail: 0, comaActive: false, status: 'alive', exhaustion: (parseInt(char.exhaustion) || 0) + 1 }; msg += " — Character Awakens (Exhaustion +1, HP 1)."; } 
        else if (f >= 3) { updates.status = 'dead'; msg += " — Body can no longer sustain life. Character is deceased."; }
    } else {
        if (roll === 20) { updates = { hpCurrent: 1, dsSucc: 0, dsFail: 0, status: 'alive' }; msg = "NATURAL 20! Back on your feet with 1 HP."; triggerCriticalSuccess(); } 
        else if (roll === 1) { f += 2; updates.currentStress = (parseInt(char.currentStress) || 0) + 1; msg = "NATURAL 1! +1 Stress & 2 Failures marked."; triggerCriticalFailure(); } 
        else if (roll >= 10) { s += 1; msg = "Success (" + roll + ")"; } 
        else { f += 1; msg = "Failure (" + roll + ")"; }
        if (s >= 3) { updates.status = 'alive'; updates.dsSucc = 0; updates.dsFail = 0; msg += " — Stabilized!"; } 
        else if (f >= 3) { updates.status = 'dead'; msg += " — Death Save Failed: Character is deceased."; }
    }
    if (updates.status !== 'alive' && updates.status !== 'dead') { updates.dsSucc = s; updates.dsFail = f; }
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), updates);
    addRollToHistory(isComa ? "Coma Save" : "Death Save", msg); window.showToast(msg);
};

window.triggerDeleteModal = () => {
    const char = characters.find(c => c.id === activeCharId); if (!char) return;
    window.resetDeleteModal(); const isA = !!char.isDeleted;
    document.getElementById('archive-btn')?.classList.toggle('hidden', isA);
    document.getElementById('restore-btn')?.classList.toggle('hidden', !isA);
    document.getElementById('delete-modal')?.classList.remove('hidden');
};

window.showPermDeleteConfirm = () => { document.getElementById('delete-stage-1')?.classList.add('hidden'); document.getElementById('delete-stage-confirm')?.classList.remove('hidden'); };
window.resetDeleteModal = () => { document.getElementById('delete-stage-1')?.classList.remove('hidden'); document.getElementById('delete-stage-confirm')?.classList.add('hidden'); };
window.archiveCharacter = async () => { if (!activeCharId) return; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), { isDeleted: true, status: 'dead' }); document.getElementById('delete-modal')?.classList.add('hidden'); window.closeSheet(); };
window.restoreCharacter = async () => { if (!activeCharId) return; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), { isDeleted: false, status: 'alive', comaActive: false }); document.getElementById('delete-modal')?.classList.add('hidden'); window.showToast("Recovered"); syncSheetData(); };
window.executePermDelete = async () => { if (!activeCharId) return; await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId)); document.getElementById('delete-modal')?.classList.add('hidden'); window.closeSheet(); };
window.openManageParty = (id) => { const p = parties.find(x => x.id === id); if (!p) return; activeManagePartyId = id; document.getElementById('manage-party-name').value = p.name; window.resetPartyManageState(); document.getElementById('manage-party-modal').classList.remove('hidden'); };
window.resetPartyManageState = () => { document.getElementById('party-manage-main').classList.remove('hidden'); document.getElementById('party-manage-delete').classList.add('hidden'); };
window.confirmDeletePartyState = () => { document.getElementById('party-manage-main').classList.add('hidden'); document.getElementById('party-manage-delete').classList.remove('hidden'); };
window.savePartyRename = async () => { if (!activeManagePartyId) return; const n = document.getElementById('manage-party-name').value; if (!n) return window.showToast("Name required"); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'parties', activeManagePartyId), { name: n }); document.getElementById('manage-party-modal').classList.add('hidden'); window.showToast("Party Renamed"); };
window.executeDeleteParty = async () => { if (!activeManagePartyId) return; const af = characters.filter(c => c.partyId === activeManagePartyId); for (const char of af) { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', char.id), { partyId: "" }); } await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'parties', activeManagePartyId)); document.getElementById('manage-party-modal').classList.add('hidden'); window.showToast("Party Disbanded"); };

const setupListeners = () => {
    if (!currentUser) return;
    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'characters'), (snap) => { characters = snap.docs.map(d => ({id: d.id, ...d.data()})); window.renderDashboard(); if (activeCharId) syncSheetData(); });
    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'parties'), (snap) => { parties = snap.docs.map(d => ({id: d.id, ...d.data()})); window.renderDashboard(); if (activeCharId) syncSheetData(); });
};

// --- GLOBAL AUTHENTICATION SYNC ---
onAuthStateChanged(auth, async (u) => {
    if (!u) {
        try { 
            // Step out to nexus folder on auth failure
            window.location.href = "../index.html"; 
        } catch(e) {
            document.getElementById('initial-loading').innerHTML = `<i class="fa-solid fa-triangle-exclamation text-6xl text-blood mb-6"></i><h2 class="font-heading text-2xl text-blood">Authentication Required</h2>`;
        }
        return;
    }
    
    try {
        if (u.isAnonymous) {
            currentUser = { uid: u.uid, email: null, username: "Guest Traveler", role: 'player' };
        } else {
            const userDoc = await getDoc(doc(db, 'users', u.uid));
            if (userDoc.exists()) {
                currentUser = { uid: u.uid, email: u.email, ...userDoc.data() };
            } else {
                currentUser = { uid: u.uid, email: u.email, username: u.displayName || 'Traveler', role: 'player' };
            }
        }

        if (u.email === 'admin@chronicles.com') {
            currentUser.role = 'dm';
        }
        activeRole = currentUser.role || 'player';

        if (appId !== "demo_campaign") {
            const campDoc = await getDoc(doc(db, 'campaigns', appId));
            if (campDoc.exists()) {
                document.getElementById('main-campaign-title').innerText = campDoc.data().name;
                document.title = `${campDoc.data().name} - Manager`;
            }
        }

        document.getElementById('user-display-name').innerText = currentUser.username;
        
        const isDM = activeRole === 'dm';
        document.getElementById('btn-create-npc')?.classList.toggle('hidden', !isDM);
        document.getElementById('nav-encounters')?.classList.toggle('hidden', !isDM);
        document.getElementById('create-actions')?.classList.remove('hidden');
        document.getElementById('btn-campaign-settings')?.classList.toggle('hidden', !isDM);

        document.getElementById('initial-loading').classList.add('hidden');
        document.getElementById('dashboard-screen').classList.remove('hidden');
        
        setupListeners();

        onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'campaignConfig', 'settings'), (docSnap) => {
            if (docSnap.exists()) {
                campaignSettings = docSnap.data();
                applyCampaignSettings(campaignSettings);
                if (activeCharId) {
                    window.calcMods();
                    window.renderMovesGrid();
                    window.updateClassSpecifics();
                    syncSheetData();
                }
            }
        }, (err) => console.error("Terminology Sync Error:", err));

    } catch (error) {
        console.error(error);
        document.getElementById('initial-loading').innerHTML = `<h2 class="font-heading text-2xl text-blood">Database Access Denied</h2>`;
    }
});

document.addEventListener('input', (e) => { 
    if (e.target.dataset.key) { 
        if (autoSaveTimer) clearTimeout(autoSaveTimer); 
        autoSaveTimer = setTimeout(() => window.saveCurrentCharacter(), 1000); 
    } 
});
