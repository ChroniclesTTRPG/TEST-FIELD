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
        const vKey = window.getVocationKey(cls.name);
        const hd = VOCATION_CONFIG[vKey]?.hitDie || 8;
        const lvl = parseInt(cls.level) || 1;
        if (lvl > 0) hdParts.push(`${lvl}d${hd}`);
        
        for (let i = 0; i < lvl; i++) {
            if (idx === 0 && i === 0) {
                totalHp += (hd + conMod); 
            } else {
                totalHp += (Math.floor(hd / 2) + 1 + conMod); 
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
    for (const k in VOCATION_CONFIG) {
        if (inputVal.includes(k) || inputVal.includes(VOCATION_CONFIG[k].name.toLowerCase())) {
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
        const data = VOCATION_CONFIG[matchedClass];
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
            const isOwner = (currentUser?.username && char.owner === currentUser.username) || char.owner === 'DM';
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

const urlParams = new URLSearchParams(window.location.search);
let appId = urlParams.get('id') || urlParams.get('campaignId');

const isPreviewEnv = window.location.href.startsWith('blob:') || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

if (!appId) {
    if (isPreviewEnv) {
        appId = "demo_campaign";
    } else {
        try {
            window.location.href = "../campaigns.html";
        } catch(e) {}
    }
}

window.routeTo = (page) => {
    try {
        let targetUrl = page;
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

// --- LEVEL UP WIZARD & MILESTONE ENGINE ---
let wizardSelectedHpGain = 0;

window.grantPartyMilestone = async () => {
    if (activeRole !== 'dm') return;
    if (!confirm("Grant a Milestone (+1 Level) to all active adventurers in the party?")) return;

    window.showToast("Granting Party Milestone...");
    const activePCs = characters.filter(c => c.type === 'PC' && !c.isDeleted);
    
    for (const pc of activePCs) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', pc.id), {
            levelUpPending: true,
            pendingLevelsCount: (pc.pendingLevelsCount || 0) + 1
        });
    }
    window.showToast("Party Milestone granted! Adventurers can now level up.");
};

window.grantSingleMilestone = async () => {
    if (!activeCharId || activeRole !== 'dm') return;
    const char = characters.find(c => c.id === activeCharId);
    if (!char) return;

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), {
        levelUpPending: true,
        pendingLevelsCount: (char.pendingLevelsCount || 0) + 1
    });
    window.showToast(`Milestone granted to ${char.name}!`);
};

window.openLevelUpWizard = () => {
    const char = characters.find(c => c.id === activeCharId);
    if (!char || !char.levelUpPending) return;

    wizardSelectedHpGain = 0;
    document.getElementById('hp-gain-result').classList.add('hidden');
    document.getElementById('btn-confirm-lvlup').disabled = true;
    document.getElementById('btn-confirm-lvlup').classList.add('opacity-50', 'cursor-not-allowed');

    const vocSelect = document.getElementById('lvl-wizard-vocation');
    if (vocSelect) {
        vocSelect.innerHTML = '';
        const classes = char.classes || [{ name: char.class || 'Warrior', level: char.level || 1 }];
        
        classes.forEach(c => {
            const vKey = window.getVocationKey(c.name);
            const vData = VOCATION_CONFIG[vKey];
            vocSelect.innerHTML += `<option value="${vKey}">[Existing] ${vData.name} (Current Lvl: ${c.level})</option>`;
        });

        for (const key in VOCATION_CONFIG) {
            if (!classes.some(c => window.getVocationKey(c.name) === key)) {
                const v = VOCATION_CONFIG[key];
                vocSelect.innerHTML += `<option value="${key}">[New Multiclass] ${v.name} (Req: ${v.multiclassReq})</option>`;
            }
        }
    }

    if (vocSelect) window.previewVocationLevel(vocSelect.value);
    document.getElementById('level-up-modal')?.classList.remove('hidden');
};

window.previewVocationLevel = (vKey) => {
    const char = characters.find(c => c.id === activeCharId);
    if (!char || !vKey) return;

    const vData = VOCATION_CONFIG[vKey];
    const classes = char.classes || [{ name: char.class || 'Warrior', level: char.level || 1 }];
    const existing = classes.find(c => window.getVocationKey(c.name) === vKey);
    const newVocationLvl = existing ? existing.level + 1 : 1;

    document.getElementById('wizard-hitdie-label').innerText = `Hit Die: d${vData.hitDie}`;
    document.getElementById('multiclass-req-text').innerText = existing ? `Vocation Level advancing to ${newVocationLvl}.` : `Multiclass Requirement: ${vData.multiclassReq}`;

    const featuresList = vData.progression[newVocationLvl] || ['General Vocation Advancement'];
    const previewContainer = document.getElementById('wizard-features-preview');
    if (previewContainer) {
        previewContainer.innerHTML = featuresList.map(f => `<div class="flex items-center gap-2"><i class="fa-solid fa-star text-gold text-[10px]"></i><span>${f}</span></div>`).join('');
    }
};

window.wizardRollHP = () => {
    const vocKey = document.getElementById('lvl-wizard-vocation').value;
    const vData = VOCATION_CONFIG[vocKey];
    const char = characters.find(c => c.id === activeCharId);
    const conMod = Math.floor(((parseInt(char.con || 10) - 10) / 2));
    
    const roll = Math.floor(Math.random() * vData.hitDie) + 1;
    wizardSelectedHpGain = Math.max(1, roll + conMod);

    const res = document.getElementById('hp-gain-result');
    res.innerText = `Rolled ${roll} + ${conMod} (CON) = +${wizardSelectedHpGain} Max HP`;
    res.classList.remove('hidden');

    document.getElementById('btn-confirm-lvlup').disabled = false;
    document.getElementById('btn-confirm-lvlup').classList.remove('opacity-50', 'cursor-not-allowed');
};

window.wizardAverageHP = () => {
    const vocKey = document.getElementById('lvl-wizard-vocation').value;
    const vData = VOCATION_CONFIG[vocKey];
    const char = characters.find(c => c.id === activeCharId);
    const conMod = Math.floor(((parseInt(char.con || 10) - 10) / 2));

    const avg = Math.floor(vData.hitDie / 2) + 1;
    wizardSelectedHpGain = Math.max(1, avg + conMod);

    const res = document.getElementById('hp-gain-result');
    res.innerText = `Average ${avg} + ${conMod} (CON) = +${wizardSelectedHpGain} Max HP`;
    res.classList.remove('hidden');

    document.getElementById('btn-confirm-lvlup').disabled = false;
    document.getElementById('btn-confirm-lvlup').classList.remove('opacity-50', 'cursor-not-allowed');
};

window.confirmLevelUp = async () => {
    const char = characters.find(c => c.id === activeCharId);
    if (!char || !wizardSelectedHpGain) return;

    const vocKey = document.getElementById('lvl-wizard-vocation').value;
    const vData = VOCATION_CONFIG[vocKey];

    let classes = char.classes || [];
    if (classes.length === 0) {
        classes = [{ name: char.class || 'Warrior', level: parseInt(char.level) || 1 }];
    }

    const existingIdx = classes.findIndex(c => window.getVocationKey(c.name) === vocKey);
    if (existingIdx !== -1) {
        classes[existingIdx].level += 1;
    } else {
        classes.push({ name: vData.name, level: 1 });
    }

    const totalCharLvl = (parseInt(char.level) || 1) + 1;
    const classStr = classes.map(c => `${c.name} ${c.level}`).join(' / ');
    const newProfBonus = window.getProficiencyBonus(totalCharLvl);
    const newMaxHp = (parseInt(char.hpMax) || 10) + wizardSelectedHpGain;

    const pendingCount = Math.max(0, (char.pendingLevelsCount || 1) - 1);

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), {
        level: totalCharLvl,
        classes: classes,
        class: classStr,
        profBonus: newProfBonus,
        hpMax: newMaxHp,
        hpCurrent: (parseInt(char.hpCurrent) || 0) + wizardSelectedHpGain,
        hdCurrent: (parseInt(char.hdCurrent) || 0) + 1,
        levelUpPending: pendingCount > 0,
        pendingLevelsCount: pendingCount
    });

    document.getElementById('level-up-modal')?.classList.add('hidden');
    window.showToast(`Congratulations! Level Up Complete: Character Level ${totalCharLvl}!`);
};

// --- EXHAUSTION CONTROLS ---
window.adjustExhaustion = async (amount, reset = false) => {
    const char = characters.find(c => c.id === activeCharId);
    if (!char) return;

    let currentLvl = parseInt(char.exhaustion) || 0;
    let newLvl = reset ? 0 : Math.max(0, Math.min(6, currentLvl + amount));

    const hiddenInput = document.querySelector('[data-key="exhaustion"]');
    if (hiddenInput) hiddenInput.value = newLvl;

    const updates = { exhaustion: newLvl };

    if (newLvl === 6) {
        updates.status = 'dead';
        updates.hpCurrent = 0;
        window.showToast("Exhaustion Level 6 reached: The character has perished.");
    }

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), updates);
    window.renderExhaustionUI(newLvl);
};

window.renderExhaustionUI = (lvl) => {
    const display = document.getElementById('exhaustion-level-display');
    if (display) display.innerText = lvl;

    for (let i = 1; i <= 6; i++) {
        const row = document.getElementById(`ex-lvl-${i}`);
        if (!row) continue;

        const statusTag = row.querySelector('.ex-status');

        if (lvl >= i) {
            row.className = i === 6 
                ? "p-1.5 rounded border border-red-900 bg-blood text-parchment flex items-center justify-between shadow-md"
                : "p-1.5 rounded border border-blood bg-blood/10 text-blood flex items-center justify-between font-black";
            if (statusTag) {
                statusTag.innerText = "ACTIVE";
                statusTag.className = "ex-status font-black text-[9px] text-blood";
                if (i === 6) statusTag.className = "ex-status font-black text-[9px] text-parchment";
            }
        } else {
            row.className = "p-1.5 rounded border border-gray-400/30 text-gray-500 flex items-center justify-between";
            if (statusTag) {
                statusTag.innerText = "INACTIVE";
                statusTag.className = "ex-status font-black text-[9px] text-gray-400";
            }
        }
    }
};

// --- STRESS THRESHOLD & DM-ONLY TRAUMA LOGIC ---
window.checkStressThreshold = (val) => {
    const curStress = parseInt(val) || 0;
    const thresholdInput = document.querySelector('[data-key="stressThreshold"]');
    const threshold = parseInt(thresholdInput?.value) || 10;
    
    const alertBanner = document.getElementById('stress-threshold-alert');

    if (curStress >= threshold) {
        if (alertBanner) alertBanner.classList.remove('hidden');
        window.showToast(`⚡ Stress threshold (${threshold}) reached! Awaiting DM/Admin to assign Trauma or Scar.`);
    } else {
        if (alertBanner) alertBanner.classList.add('hidden');
    }
};

window.openDmTraumaModal = () => {
    if (activeRole !== 'dm') {
        window.showToast("Only the Dungeon Master or Admin can assign Scars & Trauma.");
        return;
    }
    document.getElementById('dt-what').value = '';
    document.getElementById('dt-why').value = '';
    document.getElementById('dt-how').value = '';
    document.getElementById('dt-benefit').value = '';
    document.getElementById('dt-complication').value = '';
    document.getElementById('dm-trauma-modal')?.classList.remove('hidden');
};

window.saveDmTrauma = async () => {
    const char = characters.find(c => c.id === activeCharId);
    if (!char) return;

    const what = document.getElementById('dt-what').value.trim();
    const why = document.getElementById('dt-why').value.trim();
    const how = document.getElementById('dt-how').value.trim();
    const benefit = document.getElementById('dt-benefit').value.trim();
    const complication = document.getElementById('dt-complication').value.trim();

    if (!what) return window.showToast("Please write what happened.");

    const existingRecords = char.traumaRecords || [];
    const newRecord = {
        what,
        why,
        how,
        benefit,
        complication,
        assignedBy: currentUser?.username || 'DM',
        timestamp: Date.now()
    };

    const updatedRecords = [newRecord, ...existingRecords];

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), {
        traumaRecords: updatedRecords,
        currentStress: 0
    });

    document.getElementById('dm-trauma-modal')?.classList.add('hidden');
    document.getElementById('stress-threshold-alert')?.classList.add('hidden');
    window.showToast("Trauma/Scar assigned! Stress reset to 0.");
};

window.renderTraumaListUI = (records = []) => {
    const container = document.getElementById('trauma-records-list');
    const countBadge = document.getElementById('trauma-count-badge');

    if (countBadge) {
        countBadge.innerText = `${records.length} ${records.length === 1 ? 'Record' : 'Records'}`;
    }

    if (!container) return;

    if (records.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-500 italic text-center py-2">No scars or traumas recorded yet.</p>`;
        return;
    }

    container.innerHTML = records.map((r, i) => `
        <div class="bg-[rgba(255,255,255,0.4)] border border-[rgba(139,90,43,0.3)] p-3 rounded space-y-2 text-xs font-serif shadow-sm">
            <div class="flex justify-between items-start border-b border-[rgba(139,90,43,0.2)] pb-1">
                <span class="font-heading font-black text-blood uppercase text-[10px]">Record #${records.length - i}</span>
                <span class="text-[9px] text-gray-500 italic">Assigned by ${r.assignedBy || 'DM'}</span>
            </div>
            <div><strong class="text-blood block tiny-label">What Happened?</strong> <span class="italic text-ink">${r.what}</span></div>
            ${r.why ? `<div><strong class="text-555 block tiny-label">Why / Cause:</strong> <span class="italic text-ink">${r.why}</span></div>` : ''}
            ${r.how ? `<div><strong class="text-555 block tiny-label">How / Trigger:</strong> <span class="italic text-ink">${r.how}</span></div>` : ''}
            ${r.benefit ? `<div><strong class="text-green-900 block tiny-label">Situational Benefit:</strong> <span class="italic text-green-900 font-semibold">${r.benefit}</span></div>` : ''}
            ${r.complication ? `<div><strong class="text-blood block tiny-label">Complication / Narrative Hook:</strong> <span class="italic text-blood font-semibold">${r.complication}</span></div>` : ''}
        </div>
    `).join('');
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
    e.stopPropagation();
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
    
    if (currentUser?.username && c.owner === currentUser.username) badgeHtml += `<span class="status-badge bg-green-900 border border-green-700 text-parchment" style="left: 8px; right: auto;">YOURS</span>`;
    else if (!c.owner && c.type !== 'NPC' && c.type !== 'BEAST') badgeHtml += `<span class="status-badge bg-gray-700 border border-gray-500 text-parchment" style="left: 8px; right: auto;">UNCLAIMED</span>`;
    
    if (c.levelUpPending) {
        badgeHtml += `<span class="status-badge bg-gold text-black border border-yellow-200 animate-bounce" style="right: 8px">LEVEL UP!</span>`;
    }

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
        const initialOwner = (activeRole === 'dm' ? null : currentUser?.username);
        const ref = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'characters'), { 
            type, 
            name: `New Adventurer`, 
            class: "",
            ownerId: currentUser?.uid || '', 
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
            traumaRecords: [],
            passivePerception: 10,
            init: "",
            isInCombat: false,
            levelUpPending: false,
            pendingLevelsCount: 0
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
    const isOwner = (currentUser?.username && char.owner === currentUser.username) || char.owner === 'DM';
    const isDM = activeRole === 'dm';
    if (!isOwner && !isDM) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), { comaActive: val, dsSucc: 0, dsFail: 0 });
};

function syncSheetData() {
    const char = characters.find(c => c.id === activeCharId); if (!char) return;
    const ps = document.getElementById('party-select'); if (ps) { ps.innerHTML = '<option value="">Unassigned</option>'; parties.forEach(p => ps.innerHTML += `<option value="${p.id}">${p.name}</option>`); }
    const isOwner = (currentUser?.username && char.owner === currentUser.username) || char.owner === 'DM'; 
    const isDM = activeRole === 'dm'; 
    const canEdit = isOwner || isDM; 

    document.querySelectorAll('#sheet-container input, #sheet-container textarea, #sheet-container select').forEach(el => { if (el.tagName === 'SELECT' || el.type === 'checkbox') el.disabled = !canEdit; else el.readOnly = !canEdit; });
    document.getElementById('add-attack-btn').style.display = canEdit ? 'block' : 'none'; document.getElementById('sync-btn').style.display = canEdit ? 'block' : 'none'; document.getElementById('delete-char-btn').style.display = canEdit ? 'block' : 'none';
    document.querySelectorAll('.read-only-hide').forEach(el => el.classList.toggle('hidden', !canEdit));
    document.getElementById('sheet-readonly-badge').classList.toggle('hidden', canEdit);
    
    // Notes Lock
    const canEditNotes = (currentUser?.username && char.owner === currentUser.username) || (isDM && char.type !== 'PC');
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

    /* LEVEL UP WIZARD BUTTON DISPLAY */
    const lvlWizardBtn = document.getElementById('btn-level-up-wizard');
    if (lvlWizardBtn) {
        lvlWizardBtn.classList.toggle('hidden', !char.levelUpPending || !canEdit);
    }

    /* PROGRESSION & ABILITY ROLL LOCKS */
    const dmUnlockCheck = document.getElementById('dm-unlock-sheet');
    if (dmUnlockCheck) dmUnlockCheck.checked = !!char.unlockedByDM;

    const rollGenBtn = document.getElementById('main-gen-btn');
    const dmResetRollBtn = document.getElementById('dm-reset-roll-btn');

    if (char.scoresGenerated && !isDM && !char.unlockedByDM) {
        if (rollGenBtn) rollGenBtn.classList.add('hidden');
        STATS.forEach(s => {
            const el = document.querySelector(`[data-key="${s}"]`);
            if (el) { 
                el.readOnly = true; 
                el.disabled = true;
                el.classList.add('opacity-70', 'cursor-not-allowed', 'bg-transparent'); 
            }
        });
    } else {
        if (rollGenBtn && canEdit) rollGenBtn.classList.remove('hidden');
        STATS.forEach(s => {
            const el = document.querySelector(`[data-key="${s}"]`);
            if (el && canEdit) { 
                el.readOnly = false;
                el.disabled = false;
                el.classList.remove('opacity-70', 'cursor-not-allowed'); 
            }
        });
    }

    if (dmResetRollBtn) {
        dmResetRollBtn.classList.toggle('hidden', !isDM || !char.scoresGenerated);
    }

    // Check stress threshold & render trauma records
    window.checkStressThreshold(char.currentStress || 0);
    window.renderTraumaListUI(char.traumaRecords || []);

    // Render exhaustion UI
    window.renderExhaustionUI(parseInt(char.exhaustion) || 0);

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
        const isArchivist = classText.includes('archivist');
        const isNomad = classText.includes('nomad');
        
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

// --- SCORE GENERATION WITH PERMANENT LOCK & DM REROLL ---
window.openScoreGenModal = () => { 
    const char = characters.find(c => c.id === activeCharId);
    const isDM = activeRole === 'dm';
    
    if (char && char.scoresGenerated && !isDM && !char.unlockedByDM) {
        window.showToast("Ability scores have already been locked for this adventurer. Ask your DM for a reroll.");
        return;
    }

    sessionRerollUsed = false; 
    document.getElementById('score-gen-modal')?.classList.remove('hidden'); 
    document.getElementById('gen-results-area')?.classList.add('hidden'); 
    document.getElementById('gen-apply-area')?.classList.add('hidden'); 
    document.getElementById('gen-controls')?.classList.remove('hidden'); 
};

function getRoll(sides) {
    return Math.floor(Math.random() * sides) + 1;
}

window.generateScores = (method, isReroll = false) => { 
    if (method === 'standard') lastGeneratedScores = [15, 14, 13, 12, 10, 8]; 
    else { 
        if (isReroll) sessionRerollUsed = true; 
        lastGeneratedScores = Array.from({length: 6}, () => { 
            const r = [getRoll(6), getRoll(6), getRoll(6), getRoll(6)]; 
            r.sort((a,b)=>b-a); 
            return r[0]+r[1]+r[2]; 
        }).sort((a,b)=>b-a); 
    } 

    document.getElementById('gen-numbers-display').innerHTML = lastGeneratedScores.map(n => `<span class="score-line-val font-black mx-2 text-2xl text-ink font-serif">${n}</span>`).join(''); 
    document.getElementById('assign-grid').innerHTML = STATS.map(s => `<div class="bg-[rgba(255,255,255,0.4)] p-2 px-3 rounded flex justify-between items-center border border-gold"><span class="font-bold text-[10px] uppercase text-555 font-heading">${s}</span><select data-assign-stat="${s}" class="text-xs font-bold border-none bg-transparent focus:ring-0 text-ink"><option value="">-</option>${lastGeneratedScores.map((n, i) => `<option value="${i}">${n}</option>`).join('')}</select></div>`).join(''); 
    document.getElementById('gen-results-area')?.classList.remove('hidden'); 
    document.getElementById('gen-apply-area')?.classList.remove('hidden'); 
    document.getElementById('gen-controls')?.classList.add('hidden'); 
    document.getElementById('heroic-reroll-area')?.classList.toggle('hidden', method !== 'heroic' || sessionRerollUsed); 
};

window.randomizeAssignment = () => { 
    const p = [0,1,2,3,4,5].sort(()=>Math.random()-0.5); 
    Array.from(document.querySelectorAll('[data-assign-stat]')).forEach((s,i)=>s.value=p[i]); 
};

window.applyScores = async () => { 
    const selects = Array.from(document.querySelectorAll('[data-assign-stat]')); 
    const chosen = selects.map(s => s.value).filter(v => v !== ""); 
    if (chosen.length < 6 || new Set(chosen).size < 6) return window.showToast("Assign unique values to all stats"); 
    
    const updates = { scoresGenerated: true, unlockedByDM: false }; 
    selects.forEach(s => updates[s.dataset.assignStat] = lastGeneratedScores[parseInt(s.value)]); 
    
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), updates); 
    document.getElementById('score-gen-modal')?.classList.add('hidden'); 
    window.calcMods(); 
    window.showToast("Ability Scores Applied & Permanently Locked!");
};

window.dmResetAbilityScores = async () => {
    if (activeRole !== 'dm') return;
    if (!confirm("Allow this character to re-roll and reset their Ability Scores?")) return;
    
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), { 
        scoresGenerated: false,
        unlockedByDM: true 
    });
    window.showToast("Ability scores unlocked for reroll.");
    syncSheetData();
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
        total = final; label = `d${s} Roll`; breakdown = `${rollMode.toUpperCase()}: (${r1}, ${r2})`;
    } else { 
        const rolls = Array.from({length: count}, () => getRoll(s)); 
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

// --- SCRIPTCASTING GRID RENDERER WITH FIXED FILTERING & AEONFALL RULES ---
window.renderMovesGrid = () => { 
    const s = document.getElementById('moves-selector'); if (!s) return; 
    const t = s.value; const g = document.getElementById('features-lvl-grid'); if (!g) return; 
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
        const card = document.createElement('div'); 
        card.className = "lvl-card"; 
        
        // Flexible matching: check against 'features' / 'actions' and 'scriptcasting' / 'scripts'
        const filtered = moves.filter(m => {
            const mLevelMatches = m.lvl === lvl;
            if (!mLevelMatches) return false;

            if (t === 'features') {
                return !m.type || m.type === 'features' || m.type === 'actions';
            } else {
                return m.type === 'scriptcasting' || m.type === 'scripts';
            }
        });

        let html = `<div class="lvl-header">${lvl.toUpperCase()}</div><div class="flex-grow space-y-1">`;
        filtered.forEach(m => { 
            const mIdx = moves.indexOf(m); 
            html += `<div class="move-pill" ${canEdit ? `onclick="window.openMoveModal('${lvl}', ${mIdx})"` : ''}><span class="move-name">${m.name}</span><span class="move-roll">${m.roll || ''}</span></div>`; 
        });

        if (canEdit) {
            html += `</div><button onclick="window.openMoveModal('${lvl}')" class="text-[9px] font-bold uppercase text-blood hover:text-ink text-center mt-2 font-heading transition-colors">+ ADD</button>`; 
        } else {
            html += `</div>`;
        }
        
        card.innerHTML = html; 
        g.appendChild(card);
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
    if (!char) return;
    const isOwner = currentUser?.username && char.owner === currentUser.username;
    if (!isOwner && char.owner !== 'DM' && activeRole !== 'dm') return; 
    
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

window.claimCharacter = async () => { 
    const char = characters.find(c => c.id === activeCharId); 
    if (!char || char.owner || !currentUser) return; 
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', activeCharId), { owner: currentUser.username }); 
    window.showToast("Character Claimed"); 
};

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
            if (classText.includes('vanguard')) { baseAC = 10 + stats.con.mod; dexBonus = stats.dex.mod; }
            else if (classText.includes('peacekeeper')) { baseAC = 10 + stats.wis.mod; dexBonus = stats.dex.mod; }
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
    const b = window.getProficiencyBonus(l); 
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
    const isOwner = (currentUser?.username && char.owner === currentUser.username) || char.owner === 'DM';
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
        if (roll === 20) { updates = { hpCurrent: 1, dsSucc: 0, dsFail: 0, comaActive: false, status: 'alive', exhaustion: (parseInt(char.exhaustion) || 0) + 1 }; msg = "NATURAL 20! Awakening (HP 1, Exhaustion +1)."; } 
        else if (roll === 1) { f += 2; updates.currentStress = (parseInt(char.currentStress) || 0) + 1; msg = "NATURAL 1! +1 Stress, 2 Failures."; } 
        else if (roll >= 12) { s += 1; msg = "Coma Success (" + roll + ")"; } 
        else { f += 1; msg = "Coma Failure (" + roll + ")"; }
        if (s >= 3) { updates = { hpCurrent: 1, dsSucc: 0, dsFail: 0, comaActive: false, status: 'alive', exhaustion: (parseInt(char.exhaustion) || 0) + 1 }; msg += " — Character Awakens (Exhaustion +1, HP 1)."; } 
        else if (f >= 3) { updates.status = 'dead'; msg += " — Body can no longer sustain life. Character is deceased."; }
    } else {
        if (roll === 20) { updates = { hpCurrent: 1, dsSucc: 0, dsFail: 0, status: 'alive' }; msg = "NATURAL 20! Back on your feet with 1 HP."; } 
        else if (roll === 1) { f += 2; updates.currentStress = (parseInt(char.currentStress) || 0) + 1; msg = "NATURAL 1! +1 Stress & 2 Failures marked."; } 
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
    if (!currentUser || !auth.currentUser) return;
    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'characters'), (snap) => { characters = snap.docs.map(d => ({id: d.id, ...d.data()})); window.renderDashboard(); if (activeCharId) syncSheetData(); });
    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'parties'), (snap) => { parties = snap.docs.map(d => ({id: d.id, ...d.data()})); window.renderDashboard(); if (activeCharId) syncSheetData(); });
};

// --- GLOBAL AUTHENTICATION SYNC ---
onAuthStateChanged(auth, async (u) => {
    if (!u) {
        try { 
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
        
        document.getElementById('dm-party-levelup-bar')?.classList.toggle('hidden', !isDM);

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
