import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, updateDoc, setDoc, onSnapshot, getDoc, addDoc, query, where, getDocs, arrayUnion, arrayRemove, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- GLOBAL ERROR BOUNDARY FOR GITHUB PAGES / CORS ISSUES ---
window.addEventListener('error', (event) => {
    const loadingDiv = document.getElementById('initial-loading');
    if (loadingDiv && !loadingDiv.classList.contains('hidden')) {
        loadingDiv.innerHTML = `
            <div class="parchment-bg p-8 rounded border border-blood max-w-md text-center">
                <h2 class="font-heading text-xl text-blood font-bold mb-4">Script Execution Error</h2>
                <p class="text-sm font-serif text-ink mb-4">${event.message}</p>
                <p class="text-xs text-gray-600 font-bold">If you are on GitHub Pages, make sure your files are uploaded correctly and there are no syntax errors.</p>
            </div>
        `;
    }
});

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

const ADMIN_OWNER_EMAIL = "admin@chronicles.com";

let app, auth, db;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (e) {
    document.getElementById('initial-loading').innerHTML = `
        <div class="parchment-bg p-8 rounded border border-blood max-w-md text-center">
            <h2 class="font-heading text-xl text-blood font-bold mb-4">Initialization Error</h2>
            <p class="text-sm font-serif text-ink mb-4">${e.message}</p>
        </div>
    `;
}

let currentUser = null;
let allCampaigns = [];
let availablePacks = [];
let allFetchedPacks = [];
let currentViewingPack = null;
let packMessagesUnsubscribe = null;
let adminModeActive = false;

// Chat State
let globalChatUnsub = null;
let dmContactsUnsub = null;
let activeDmUnsub = null;
window.activeChatTargetId = null;
window.activeChatTargetName = "";
window.activeChatIsGroup = false;
window.activeChatMembers = [];
window.myDmContactIds = [];
let dmUnreadCounts = {};
window.globalMessages = [];
window.myMessageLog = []; 

// Friends State
window.myFriends = [];
window.myFriendRequests = [];
let friendsUnsub = null;
let reqsUnsub = null;

const checkRateLimit = (text) => {
    const now = Date.now();
    window.myMessageLog = window.myMessageLog.filter(t => now - t.time < 10000);

    if (window.myMessageLog.length >= 5) {
        window.showToast("You are speaking too quickly. Please wait a moment.");
        return false;
    }
    if (window.myMessageLog.length > 0 && window.myMessageLog[window.myMessageLog.length - 1].text === text) {
        window.showToast("Do not repeat yourself, traveler.");
        return false;
    }
    if (currentUser.mutedUntil && currentUser.mutedUntil > now) {
        const minLeft = Math.ceil((currentUser.mutedUntil - now) / 60000);
        window.showToast(`You have been silenced for ${minLeft} more minutes.`);
        return false;
    }
    if (currentUser.isBanned) {
        window.showToast("You are banished. Action denied.");
        return false;
    }
    window.myMessageLog.push({time: now, text: text});
    return true;
}

const isUserBlocked = (uid) => {
    return (currentUser.blockedUsers || []).includes(uid);
};

// Check if minor is allowed to contact this UID
window.isAllowedContact = (targetUid) => {
    if (!currentUser) return false;
    if (currentUser.ageCategory !== 'under_17') return true; // Adults have no age restrictions
    if (targetUid === ADMIN_OWNER_EMAIL || (adminModeActive && targetUid === currentUser.uid)) return true; 
    
    // Minors can only contact the DM of a campaign they are in
    const myCampaigns = allCampaigns.filter(c => (currentUser.joinedCampaigns || []).includes(c.id));
    const allowedDmIds = myCampaigns.map(c => c.dmId);
    return allowedDmIds.includes(targetUid);
};

function generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

window.toggleAdminMode = () => {
    adminModeActive = !adminModeActive;
    const btn = document.getElementById('btn-admin-terminal');
    const clearTavernBtn = document.getElementById('btn-clear-tavern');
    if (adminModeActive) {
        btn.classList.add('admin-glow');
        if (clearTavernBtn) clearTavernBtn.classList.remove('hidden');
        window.showToast("Admin Override Active. You see all.");
    } else {
        btn.classList.remove('admin-glow');
        if (clearTavernBtn) clearTavernBtn.classList.add('hidden');
        window.showToast("Admin Override Deactivated.");
    }
    renderCampaigns(); 
    if (window.renderGlobalChat) window.renderGlobalChat(); 
    if (window.activeChatTargetId) {
        window.openDirectMessage(window.activeChatTargetId, window.activeChatTargetName, window.activeChatIsGroup, window.activeChatMembers.join(','));
    }
};

function createCampaignCard(camp, isMine) {
    const d = document.createElement('div');
    d.className = "bg-black bg-opacity-60 rounded-lg card p-5 flex flex-col justify-between group";
    
    const isDM = (currentUser && camp.dmId === currentUser.uid) || adminModeActive;
    
    d.onclick = () => {
        if (isMine || adminModeActive) {
            try { window.location.href = `characters.html?id=${camp.id}`; } 
            catch(e) { window.showToast("Redirects disabled in preview window."); }
        } else if (currentUser.role === 'player' && camp.visibility === 'public') {
            window.joinPublicCampaign(camp.id, camp.name);
        } else if (currentUser.role === 'dm' && !isMine) {
            window.showToast("Dungeon Masters only manage their own realms.");
        }
    };

    let badges = '';
    
    if (isDM && !adminModeActive) badges += `<span class="bg-blood text-white px-2 py-0.5 rounded text-[8px] uppercase tracking-widest font-heading font-black shadow-md mr-1">DM</span>`;
    if (isMine) badges += `<span class="bg-green-700 text-white px-2 py-0.5 rounded text-[8px] uppercase tracking-widest font-heading font-black shadow-md mr-1">Joined</span>`;

    if (camp.visibility === 'private') badges += `<span class="bg-gray-800 text-gray-400 border border-gray-600 px-2 py-0.5 rounded text-[8px] uppercase tracking-widest font-heading shadow-md"><i class="fa-solid fa-lock text-[7px] mr-1"></i>Private</span>`;
    else if (camp.visibility === 'public' && camp.maxPlayers) badges += `<span class="bg-blue-900 text-blue-200 border border-blue-700 px-2 py-0.5 rounded text-[8px] uppercase tracking-widest font-heading shadow-md"><i class="fa-solid fa-users text-[7px] mr-1"></i>Max ${camp.maxPlayers}</span>`;

    if (camp.packName && camp.packName !== 'Blank Slate') badges += `<span class="bg-indigo-900 text-indigo-200 border border-indigo-700 px-2 py-0.5 rounded text-[8px] uppercase tracking-widest font-heading shadow-md mt-1 block w-fit"><i class="fa-solid fa-book-journal-whills text-[7px] mr-1"></i>${camp.packName}</span>`;

    const editBtn = isDM ? `<button onclick="event.stopPropagation(); window.openEditCampaign('${camp.id}')" class="text-gold hover:text-yellow-400 transition-colors" title="Edit Realm"><i class="fa-solid fa-pen"></i></button>` : '';
    const deleteBtn = isDM ? `<button onclick="event.stopPropagation(); window.deleteCampaign('${camp.id}', '${camp.name.replace(/'/g, "\\'")}', '${camp.dmId}')" class="text-blood hover:text-red-400 transition-colors" title="Delete Realm"><i class="fa-solid fa-trash-can"></i></button>` : '';
    const leaveBtn = (!isDM && isMine && !adminModeActive) ? `<button onclick="event.stopPropagation(); window.leaveCampaign('${camp.id}', '${camp.name.replace(/'/g, "\\'")}')" class="text-gray-400 hover:text-parchment transition-colors" title="Leave Realm"><i class="fa-solid fa-right-from-bracket"></i></button>` : '';

    const descText = camp.description ? `<p class="text-xs text-gray-400 font-serif mb-4 line-clamp-2">${camp.description}</p>` : '';

    let footerText = 'Click to enter realm';
    if (isDM || adminModeActive) footerText = `Code: <span class="text-white bg-gray-800 px-1 rounded">${camp.inviteCode}</span>`;
    else if (!isMine && currentUser.role === 'player') footerText = '<span class="text-gold group-hover:text-yellow-300 transition-colors"><i class="fa-solid fa-door-open mr-1"></i> Click to Join Realm</span>';
    else if (!isMine && currentUser.role === 'dm') footerText = '<span class="text-gray-600">Locked to other DMs</span>';

    d.innerHTML = `
        <div>
            <div class="flex justify-between items-start mb-2">
                <div class="flex-grow pr-4">
                    <h3 class="text-xl font-heading font-bold text-gold drop-shadow leading-tight m-0 mb-1 flex flex-wrap items-center gap-1">
                        ${camp.name}
                    </h3>
                    <div class="flex flex-wrap gap-1 items-center">${badges}</div>
                </div>
                <div class="flex flex-col items-end gap-3 shrink-0 pt-1">
                    ${editBtn}
                    ${deleteBtn}
                    ${leaveBtn}
                </div>
            </div>
            <p class="text-xs text-gray-500 font-serif italic mb-2">Run by ${camp.dmName || 'Unknown DM'}</p>
            ${descText}
        </div>
        <div class="border-t border-gray-700 pt-3 flex justify-between items-center mt-2">
            <span class="text-[9px] text-gray-500 uppercase font-heading tracking-widest">${footerText}</span>
            <i class="fa-solid fa-chevron-right ${!isMine && currentUser.role === 'dm' && !adminModeActive ? 'text-gray-800' : 'text-gray-600 group-hover:text-gold transition-colors'} text-xs"></i>
        </div>
    `;
    return d;
}

function renderCampaigns() {
    const myGrid = document.getElementById('my-adventures-grid');
    const pubGrid = document.getElementById('public-realms-grid');
    
    myGrid.innerHTML = ''; 
    pubGrid.innerHTML = '';

    const joinedIds = currentUser?.joinedCampaigns || [];

    if (adminModeActive) {
        document.getElementById('grid-title-1').innerHTML = '<i class="fa-solid fa-triangle-exclamation text-red-500 mr-2"></i> Owner Archive Override (All Realms)';
        document.getElementById('grid-title-2').classList.add('hidden');
        pubGrid.classList.add('hidden');

        allCampaigns.forEach(camp => {
            myGrid.appendChild(createCampaignCard(camp, false)); 
        });
    } else {
        document.getElementById('grid-title-1').innerText = 'My Adventures';
        document.getElementById('grid-title-2').classList.remove('hidden');
        pubGrid.classList.remove('hidden');

        allCampaigns.forEach(camp => {
            const isMine = joinedIds.includes(camp.id) || camp.dmId === currentUser.uid;
            
            if (isMine) {
                myGrid.appendChild(createCampaignCard(camp, true));
            } else if (camp.visibility === 'public') {
                pubGrid.appendChild(createCampaignCard(camp, false));
            }
        });
    }

    if (myGrid.children.length === 0) {
        myGrid.innerHTML = `<div class="col-span-full py-4 text-center border border-dashed border-gray-800 rounded bg-black bg-opacity-30"><p class="text-gray-500 text-xs italic font-serif">No adventures found.</p></div>`;
    }
    if (pubGrid.children.length === 0 && !adminModeActive) {
        pubGrid.innerHTML = `<div class="col-span-full py-4 text-center border border-dashed border-gray-800 rounded bg-black bg-opacity-30"><p class="text-gray-500 text-xs italic font-serif">No public realms are currently available.</p></div>`;
    }
}

window.toggleChatPanel = () => {
    const panel = document.getElementById('global-chat-panel');
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
        document.getElementById('global-unread-badge').classList.add('hidden');
        setTimeout(() => {
            const gContainer = document.getElementById('global-chat-messages');
            gContainer.scrollTop = gContainer.scrollHeight;
        }, 100);
    }
};

window.switchChatTab = (tab) => {
    document.querySelectorAll('.chat-tab').forEach(b => b.classList.remove('active'));
    document.getElementById(`chat-tab-${tab}`).classList.add('active');
    
    document.getElementById('chat-view-global').classList.add('hidden');
    document.getElementById('chat-view-dms').classList.add('hidden');
    document.getElementById('chat-view-active-dm').classList.add('hidden');
    const reportsView = document.getElementById('chat-view-reports');
    if(reportsView) reportsView.classList.add('hidden');
    
    if (tab === 'global') {
        document.getElementById('chat-view-global').classList.remove('hidden');
        setTimeout(() => {
            const gContainer = document.getElementById('global-chat-messages');
            gContainer.scrollTop = gContainer.scrollHeight;
        }, 50);
    } else if (tab === 'dms') {
        document.getElementById('chat-view-dms').classList.remove('hidden');
        window.activeChatTargetId = null;
        document.getElementById('dm-tab-badge').classList.add('hidden');
    } else if (tab === 'reports') {
        if(reportsView) reportsView.classList.remove('hidden');
        document.getElementById('report-tab-badge').classList.add('hidden');
    }
};

window.formatChatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

window.initGlobalChat = () => {
    if (globalChatUnsub) globalChatUnsub();
    
    const q = query(collection(db, 'artifacts', 'global_chat', 'public', 'data', 'messages'));
    
    globalChatUnsub = onSnapshot(q, (snap) => {
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        window.globalMessages = snap.docs
            .map(d => ({id: d.id, ...d.data()}))
            .filter(m => m.timestamp > oneDayAgo) 
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-50);
        window.renderGlobalChat();
    });
};

window.renderGlobalChat = () => {
    const container = document.getElementById('global-chat-messages');
    
    // Apply Age Restriction to the Tavern
    if (currentUser && currentUser.ageCategory === 'under_17') {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center p-6 opacity-70">
                <i class="fa-solid fa-shield-halved text-4xl text-gray-600 mb-4 mt-10"></i>
                <p class="text-xs text-gray-400 font-serif italic mb-2">The Tavern is restricted to travelers 17 and older.</p>
                <p class="text-[10px] text-gray-500 font-serif italic">You may only communicate privately with your Dungeon Master in the Whispers tab.</p>
            </div>
        `;
        document.getElementById('global-chat-input').disabled = true;
        document.getElementById('global-chat-input').placeholder = "Chat disabled for your age group.";
        return;
    }

    const msgs = window.globalMessages || [];
    const searchTerm = (document.getElementById('global-search-input')?.value || '').toLowerCase().trim();
    const filteredMsgs = searchTerm ? msgs.filter(m => m.text.toLowerCase().includes(searchTerm) || m.authorName.toLowerCase().includes(searchTerm)) : msgs;

    if (filteredMsgs.length === 0) {
        container.innerHTML = searchTerm ? `<p class="text-xs text-gray-500 italic text-center py-4">No matching messages...</p>` : `<p class="text-xs text-gray-500 italic text-center py-4">The tavern is quiet...</p>`;
    } else {
        container.innerHTML = filteredMsgs.map(m => {
            if (isUserBlocked(m.authorId)) return '';

            const isMe = m.authorId === currentUser.uid;
            const roleColor = m.authorRole === 'dm' ? 'text-blood' : 'text-gold';
            const roleIcon = m.authorRole === 'dm' ? '<i class="fa-solid fa-dragon ml-1 text-[8px]" title="Dungeon Master"></i>' : '';
            const align = isMe ? 'text-right' : 'text-left';
            const bg = isMe ? 'bg-indigo-900/30 border-indigo-800' : 'bg-black/40 border-gray-700';
            
            let adminTools = '';
            if (adminModeActive) {
                if (!m.isDeleted) adminTools = `<button onclick="window.deleteChatMessage('${m.id}')" class="text-gray-500 hover:text-red-500 ml-2" title="Delete Message"><i class="fa-solid fa-trash-can"></i></button>`;
            }

            const reportBtn = (!isMe && !m.isDeleted) ? `<button onclick="window.promptReportUser('${m.authorId}', '${m.authorName.replace(/'/g, "\\'")}', '${m.text.replace(/'/g, "\\'").replace(/"/g, '&quot;').substring(0, 50)}')" class="text-gray-500 hover:text-yellow-500 ml-1" title="Report User"><i class="fa-solid fa-flag"></i></button>` : '';

            let msgContent = m.text;
            let deletedClass = '';
            
            if (m.isDeleted) {
                if (adminModeActive) {
                    deletedClass = 'deleted-msg-admin';
                    msgContent = `<span class="text-red-500 font-bold uppercase text-[9px] block mb-1">Deleted by ${m.deletedBy}</span>` + m.text;
                } else {
                    return `<div class="chat-msg ${align}"><p class="text-[10px] text-gray-600 italic">This message was removed by the archives.</p></div>`;
                }
            }

            return `
            <div class="chat-msg ${align}">
                <div class="text-[9px] font-heading font-bold uppercase tracking-widest mb-1">
                    <span onclick="window.promptDirectMessage('${m.authorId}', '${m.authorName.replace(/'/g, "\\'")}')" class="${roleColor} cursor-pointer hover:underline transition-colors" title="Whisper ${m.authorName}">${m.authorName}${roleIcon}</span>
                    <span class="text-gray-600 ml-2">${window.formatChatTime(m.timestamp)}</span>
                    ${adminTools}
                    ${reportBtn}
                </div>
                <div class="inline-block p-2 rounded text-sm font-serif text-gray-300 border ${bg} ${deletedClass} text-left max-w-[85%] break-words">
                    ${msgContent}
                </div>
            </div>
            `;
        }).join('');
        
        if (!searchTerm) {
            container.scrollTop = container.scrollHeight;
        }
        
        const panel = document.getElementById('global-chat-panel');
        if (!panel.classList.contains('open') && msgs.length > 0) {
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg.authorId !== currentUser.uid && !isUserBlocked(lastMsg.authorId)) {
                document.getElementById('global-unread-badge').classList.remove('hidden');
            }
        }
    }
};

window.deleteChatMessage = async (msgId) => {
    if (!adminModeActive) return;
    try {
        await updateDoc(doc(db, 'artifacts', 'global_chat', 'public', 'data', 'messages', msgId), {
            isDeleted: true,
            deletedBy: currentUser.username,
            deletedAt: Date.now()
        });
        window.showToast("Message erased from archives.");
    } catch(e) {
        window.showToast("Failed to delete message.");
    }
};

window.clearGlobalChat = async () => {
    if (!adminModeActive) return;
    if (!confirm("Are you sure you want to completely wipe the Tavern chat? This cannot be undone.")) return;
    
    window.showToast("Wiping the Tavern...");
    try {
        const snap = await getDocs(collection(db, 'artifacts', 'global_chat', 'public', 'data', 'messages'));
        const promises = snap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(promises);
        window.showToast("The Tavern has been wiped clean.");
    } catch(e) {
        console.error(e);
        window.showToast("Failed to wipe the Tavern.");
    }
};

window.sendGlobalMessage = async () => {
    const input = document.getElementById('global-chat-input');
    const text = input.value.trim();
    if (!text || !currentUser) return;
    
    if (currentUser.ageCategory === 'under_17') return window.showToast("Minors cannot post in the Tavern.");
    if (!checkRateLimit(text)) return;
    
    input.value = '';
    try {
        await addDoc(collection(db, 'artifacts', 'global_chat', 'public', 'data', 'messages'), {
            text: text,
            authorId: currentUser.uid,
            authorName: currentUser.username,
            authorRole: currentUser.role,
            timestamp: Date.now()
        });
    } catch (err) {
        console.error("Failed to send message", err);
        window.showToast("Failed to send message.");
    }
    
    document.getElementById('global-chat-input').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') window.sendGlobalMessage();
    });
};

window.openChatSettings = () => {
    document.getElementById('setting-block-strangers').checked = currentUser.blockStrangers || false;
    document.getElementById('chat-settings-modal').classList.remove('hidden');
};

window.saveChatSettings = async () => {
    const blockStrangers = document.getElementById('setting-block-strangers').checked;
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), { blockStrangers: blockStrangers });
        currentUser.blockStrangers = blockStrangers;
        document.getElementById('chat-settings-modal').classList.add('hidden');
        window.showToast("Privacy settings saved.");
    } catch(e) {
        window.showToast("Failed to save settings.");
    }
};

window.initDirectMessaging = () => {
    if (dmContactsUnsub) dmContactsUnsub();
    
    dmContactsUnsub = onSnapshot(collection(db, 'artifacts', 'global_chat', 'public', 'data', `dm_contacts_${currentUser.uid}`), (snap) => {
        window.myDmContactIds = snap.docs.map(d => d.id);
        const contacts = snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a, b) => b.lastUpdated - a.lastUpdated);
        const list = document.getElementById('dm-contacts-list');
        
        dmUnreadCounts = {};
        let totalUnread = false;

        if (contacts.length === 0) {
            list.innerHTML = `<p class="text-xs text-gray-500 italic text-center py-4">No active whispers.</p>`;
        } else {
            list.innerHTML = contacts.map(c => {
                if (!c.isGroup && isUserBlocked(c.id)) return ''; 
                if (!c.isGroup && !window.isAllowedContact(c.id)) return ''; 

                const hasUnread = c.unreadCount > 0;
                if (hasUnread) totalUnread = true;
                
                const iconHTML = c.isGroup ? `<i class="fa-solid fa-users text-gold text-[10px] mr-1"></i>` : '';
                const membersStr = c.isGroup && c.members ? c.members.join(',') : '';
                
                return `
                <div class="dm-contact ${hasUnread ? 'has-unread' : ''}" onclick="window.openDirectMessage('${c.id}', '${c.name.replace(/'/g, "\\'")}', ${c.isGroup ? 'true' : 'false'}, '${membersStr}')">
                    <div>
                        <h4 class="font-heading text-sm font-bold text-gray-300 uppercase tracking-widest">${iconHTML}${c.name}</h4>
                        <p class="text-[10px] text-gray-500 font-serif truncate max-w-[250px]">${c.lastMessage || '...'}</p>
                    </div>
                    <div class="text-right flex flex-col items-end justify-center">
                        <span class="text-[9px] text-gray-600 font-bold mb-1">${window.formatChatTime(c.lastUpdated)}</span>
                        ${hasUnread ? `<span class="bg-blood text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">${c.unreadCount}</span>` : ''}
                    </div>
                </div>
                `;
            }).join('');
        }
        
        if (totalUnread && document.getElementById('chat-view-dms').classList.contains('hidden') && document.getElementById('chat-view-active-dm').classList.contains('hidden')) {
            document.getElementById('dm-tab-badge').classList.remove('hidden');
            if (!document.getElementById('global-chat-panel').classList.contains('open')) {
                document.getElementById('global-unread-badge').classList.remove('hidden');
            }
        }
    });
};

window.searchUsersForDM = async () => {
    const queryText = document.getElementById('dm-search-input').value.trim().toLowerCase();
    if (!queryText) return window.showToast("Enter a name to search.");
    
    try {
        const snap = await getDocs(collection(db, 'users'));
        const results = snap.docs
            .map(d => ({id: d.id, ...d.data()}))
            .filter(u => u.uid !== currentUser.uid && u.username && u.username.toLowerCase().includes(queryText) && !isUserBlocked(u.uid) && window.isAllowedContact(u.uid));
            
        const list = document.getElementById('dm-contacts-list');
        
        if (results.length === 0) {
            list.innerHTML = `<p class="text-xs text-gray-500 italic text-center py-4">No travelers found by that name.</p>`;
        } else {
            list.innerHTML = `<p class="text-[10px] text-gold font-heading font-bold uppercase tracking-widest p-2 bg-black/40 border-b border-gray-700">Search Results</p>` + 
            results.map(u => `
                <div class="dm-contact hover:bg-indigo-900/20" onclick="window.promptDirectMessage('${u.uid}', '${u.username.replace(/'/g, "\\'")}')">
                    <div>
                        <h4 class="font-heading text-sm font-bold text-gray-300 uppercase tracking-widest">${u.username}</h4>
                        <p class="text-[10px] text-gray-500 font-serif">Start a whisper...</p>
                    </div>
                    <div class="flex items-center"><i class="fa-solid fa-chevron-right text-gray-600"></i></div>
                </div>
            `).join('');
        }
    } catch (e) {
        console.error(e);
        window.showToast("Search failed.");
    }
};

window.pendingDmTarget = null;

window.promptDirectMessage = (uid, username) => {
    if (currentUser && uid === currentUser.uid) {
        return window.showToast("You cannot interact with yourself.");
    }
    if (isUserBlocked(uid)) {
        return window.showToast("This user is blocked.");
    }
    if (!window.isAllowedContact(uid)) {
        return window.showToast("Safety Restriction: You may only whisper your Dungeon Master.");
    }

    if (window.myDmContactIds && window.myDmContactIds.includes(uid)) {
        window.switchChatTab('dms');
        window.openDirectMessage(uid, username);
        return;
    }

    window.pendingDmTarget = { id: uid, name: username };
    document.getElementById('dm-confirm-name').innerText = username;
    
    const addBtn = document.getElementById('btn-add-friend');
    const isFriend = window.myFriends.some(f => f.id === uid);
    if (isFriend) {
        addBtn.classList.add('hidden');
    } else {
        addBtn.classList.remove('hidden');
    }

    document.getElementById('dm-confirm-modal').classList.remove('hidden');
};

window.confirmDirectMessage = () => {
    if (!window.pendingDmTarget) return;
    document.getElementById('dm-confirm-modal').classList.add('hidden');
    window.switchChatTab('dms');
    window.openDirectMessage(window.pendingDmTarget.id, window.pendingDmTarget.name);
    window.pendingDmTarget = null;
};

window.activeDmMessages = [];

window.renderActiveDM = () => {
    const msgs = window.activeDmMessages || [];
    const container = document.getElementById('active-dm-messages');
    const targetName = window.activeChatTargetName;
    const convId = window.activeChatIsGroup ? window.activeChatTargetId : [currentUser.uid, window.activeChatTargetId].sort().join('_');
    
    const searchTerm = (document.getElementById('dm-search-message-input')?.value || '').toLowerCase().trim();
    const filteredMsgs = searchTerm ? msgs.filter(m => m.text.toLowerCase().includes(searchTerm) || (m.authorId === currentUser.uid ? currentUser.username.toLowerCase() : targetName.toLowerCase()).includes(searchTerm)) : msgs;

    if (filteredMsgs.length === 0) {
        container.innerHTML = searchTerm ? `<p class="text-xs text-gray-500 italic text-center py-4">No matching messages...</p>` : `<p class="text-xs text-gray-500 italic text-center py-4">This is the start of your private history with ${targetName}.</p>`;
    } else {
        container.innerHTML = filteredMsgs.map(m => {
            if (m.authorId === 'system') {
                return `<div class="chat-msg text-center my-2 border-none"><span class="text-[10px] text-gray-500 italic bg-black/50 px-3 py-1.5 rounded shadow-inner inline-block mx-auto max-w-[80%] break-words">${m.text}</span></div>`;
            }

            const isMe = m.authorId === currentUser.uid;
            const align = isMe ? 'text-right' : 'text-left';
            const bg = isMe ? 'bg-blood/20 border-blood/50 text-parchment' : 'bg-black/40 border-gray-700 text-gray-300';
            
            let adminTools = '';
            if (adminModeActive && !m.isDeleted) {
                adminTools = `<button onclick="window.deleteDirectMessage('${m.id}', '${convId}')" class="text-gray-500 hover:text-red-500 ml-2" title="Delete Message"><i class="fa-solid fa-trash-can"></i></button>`;
            }

            const msgAuthorName = isMe ? currentUser.username : (window.activeChatIsGroup && m.authorName ? m.authorName : targetName);
            const reportBtn = (!isMe && !m.isDeleted) ? `<button onclick="window.promptReportUser('${m.authorId}', '${msgAuthorName.replace(/'/g, "\\'")}', '${m.text.replace(/'/g, "\\'").replace(/"/g, '&quot;').substring(0, 50)}')" class="text-gray-500 hover:text-yellow-500 ml-1" title="Report User"><i class="fa-solid fa-flag"></i></button>` : '';

            let msgContent = m.text;
            let deletedClass = '';
            
            if (m.isDeleted) {
                if (adminModeActive) {
                    deletedClass = 'deleted-msg-admin';
                    msgContent = `<span class="text-red-500 font-bold uppercase text-[9px] block mb-1">Deleted by ${m.deletedBy}</span>` + m.text;
                } else {
                    return `<div class="chat-msg ${align}"><p class="text-[10px] text-gray-600 italic">This message was removed by the archives.</p></div>`;
                }
            }

            return `
            <div class="chat-msg ${align}">
                <div class="text-[9px] font-heading font-bold uppercase tracking-widest mb-1">
                    <span class="text-gray-500">${window.formatChatTime(m.timestamp)}</span>
                    ${adminTools}
                    ${reportBtn}
                </div>
                <div class="inline-block p-2 rounded text-sm font-serif border ${bg} ${deletedClass} text-left max-w-[85%] break-words">
                    ${window.activeChatIsGroup && !isMe && !m.isDeleted ? `<span class="text-[9px] font-heading font-black text-gold uppercase tracking-widest block mb-1">${msgAuthorName}</span>` : ''}
                    ${msgContent}
                </div>
            </div>
            `;
        }).join('');
        
        if (!searchTerm) {
            container.scrollTop = container.scrollHeight;
        }
    }
};

window.openDirectMessage = async (targetId, targetName, isGroup = false, membersStr = "") => {
    window.activeChatTargetId = targetId;
    window.activeChatTargetName = targetName;
    window.activeChatIsGroup = isGroup === true || isGroup === 'true';
    window.activeChatMembers = membersStr ? membersStr.split(',') : [];
    
    document.getElementById('chat-view-dms').classList.add('hidden');
    document.getElementById('chat-view-active-dm').classList.remove('hidden');
    document.getElementById('active-dm-name').innerText = targetName;
    if(document.getElementById('dm-search-message-input')) document.getElementById('dm-search-message-input').value = '';

    const toolsContainer = document.getElementById('active-dm-tools');
    if (window.activeChatIsGroup) {
        let toolsHTML = `<button onclick="window.clearDMConversation()" class="text-gray-500 hover:text-orange-500 transition-colors" title="Leave Group"><i class="fa-solid fa-right-from-bracket"></i></button>`;
        if (currentUser.role === 'dm' || currentUser.role === 'admin' || adminModeActive) {
            toolsHTML = `
                <button onclick="window.renameGroup()" class="text-gray-500 hover:text-gold transition-colors" title="Rename Group"><i class="fa-solid fa-pen"></i></button>
                <button onclick="window.deleteGroup()" class="text-gray-500 hover:text-red-500 transition-colors" title="Delete Group for All"><i class="fa-solid fa-trash-can"></i></button>
            ` + toolsHTML;
        }
        toolsContainer.innerHTML = toolsHTML;
    } else {
        toolsContainer.innerHTML = `
            <button onclick="window.clearDMConversation()" class="text-gray-500 hover:text-orange-500 transition-colors" title="Clear/Hide Conversation"><i class="fa-solid fa-trash-can"></i></button>
            <button onclick="window.promptBlockUser(window.activeChatTargetId, window.activeChatTargetName)" class="text-gray-500 hover:text-red-500 transition-colors" title="Block User"><i class="fa-solid fa-ban"></i></button>
        `;
    }
    
    try {
        await updateDoc(doc(db, 'artifacts', 'global_chat', 'public', 'data', `dm_contacts_${currentUser.uid}`, targetId), { unreadCount: 0 });
    } catch(e) {} 

    const convId = window.activeChatIsGroup ? targetId : [currentUser.uid, targetId].sort().join('_');
    
    if (activeDmUnsub) activeDmUnsub();
    
    activeDmUnsub = onSnapshot(collection(db, 'artifacts', 'global_chat', 'public', 'data', `dm_messages_${convId}`), (snap) => {
        window.activeDmMessages = snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a, b) => a.timestamp - b.timestamp);
        window.renderActiveDM();
    });
};

window.closeActiveDM = () => {
    window.activeChatTargetId = null;
    window.activeChatIsGroup = false;
    window.activeChatMembers = [];
    if (activeDmUnsub) { activeDmUnsub(); activeDmUnsub = null; }
    document.getElementById('chat-view-active-dm').classList.add('hidden');
    document.getElementById('chat-view-dms').classList.remove('hidden');
};

window.clearDMConversation = async () => {
    if (!window.activeChatTargetId) return;
    const actionText = window.activeChatIsGroup ? 'leave this alliance' : 'clear this whisper from your active list';
    if (!confirm(`Are you sure you want to ${actionText}?`)) return;
    
    try {
        if (window.activeChatIsGroup) {
             try {
                 const groupDocRef = doc(db, 'artifacts', 'global_chat', 'public', 'data', 'groups', window.activeChatTargetId);
                 await updateDoc(groupDocRef, {
                     members: arrayRemove(currentUser.uid)
                 });
                 
                 await addDoc(collection(db, 'artifacts', 'global_chat', 'public', 'data', `dm_messages_${window.activeChatTargetId}`), {
                    text: `${currentUser.username} has left the alliance.`,
                    authorId: 'system',
                    timestamp: Date.now()
                });
             } catch(e) { console.error("Failed to remove from group array", e); }
        }

        await deleteDoc(doc(db, 'artifacts', 'global_chat', 'public', 'data', `dm_contacts_${currentUser.uid}`, window.activeChatTargetId));
        window.showToast(window.activeChatIsGroup ? "Alliance left." : "Whisper cleared.");
        window.closeActiveDM();
    } catch (err) {
        console.error(err);
        window.showToast("Failed to complete action.");
    }
};

window.sendDirectMessage = async () => {
    const input = document.getElementById('active-dm-input');
    const text = input.value.trim();
    if (!text || !currentUser || !window.activeChatTargetId) return;
    
    if (!checkRateLimit(text)) return;
    
    if (!window.activeChatIsGroup) {
        try {
            const targetDoc = await getDoc(doc(db, 'users', window.activeChatTargetId));
            if (targetDoc.exists() && targetDoc.data().blockStrangers) {
                const targetCamps = allCampaigns.filter(c => c.dmId === window.activeChatTargetId);
                const sharesRealm = targetCamps.some(c => (currentUser.joinedCampaigns || []).includes(c.id));
                
                if (!sharesRealm) {
                    return window.showToast("This user is not accepting whispers from strangers.");
                }
            }
        } catch(e) {} 
    }
    
    input.value = '';
    const convId = window.activeChatIsGroup ? window.activeChatTargetId : [currentUser.uid, window.activeChatTargetId].sort().join('_');
    const now = Date.now();

    try {
        await addDoc(collection(db, 'artifacts', 'global_chat', 'public', 'data', `dm_messages_${convId}`), {
            text: text,
            authorId: currentUser.uid,
            authorName: currentUser.username,
            timestamp: now
        });

        if (window.activeChatIsGroup) {
            let freshMembers = window.activeChatMembers;
            try {
                const gSnap = await getDoc(doc(db, 'artifacts', 'global_chat', 'public', 'data', 'groups', window.activeChatTargetId));
                if (gSnap.exists()) freshMembers = gSnap.data().members || freshMembers;
            } catch(e) {}

            freshMembers.forEach(async (memberUid) => {
                const targetRef = doc(db, 'artifacts', 'global_chat', 'public', 'data', `dm_contacts_${memberUid}`, window.activeChatTargetId);
                const targetSnap = await getDoc(targetRef);
                const targetData = targetSnap.exists() ? targetSnap.data() : {
                    name: window.activeChatTargetName,
                    isGroup: true,
                    members: freshMembers
                };
                await setDoc(targetRef, {
                    ...targetData,
                    lastMessage: `${currentUser.username}: ${text}`,
                    lastUpdated: now,
                    unreadCount: memberUid === currentUser.uid ? 0 : (targetData.unreadCount || 0) + 1,
                }, { merge: true });
            });
        } else {
            await setDoc(doc(db, 'artifacts', 'global_chat', 'public', 'data', `dm_contacts_${currentUser.uid}`, window.activeChatTargetId), {
                name: window.activeChatTargetName,
                lastMessage: text,
                lastUpdated: now,
                unreadCount: 0
            }, { merge: true });

            const targetRef = doc(db, 'artifacts', 'global_chat', 'public', 'data', `dm_contacts_${window.activeChatTargetId}`, currentUser.uid);
            const targetSnap = await getDoc(targetRef);
            const currentUnread = targetSnap.exists() ? (targetSnap.data().unreadCount || 0) : 0;
            
            await setDoc(targetRef, {
                name: currentUser.username,
                lastMessage: text,
                lastUpdated: now,
                unreadCount: currentUnread + 1
            }, { merge: true });
        }

    } catch (err) {
        console.error("Failed to send private message", err);
        window.showToast("Failed to deliver whisper.");
    }
};

window.deleteDirectMessage = async (msgId, convId) => {
    if (!adminModeActive) return;
    try {
        await updateDoc(doc(db, 'artifacts', 'global_chat', 'public', 'data', `dm_messages_${convId}`, msgId), {
            isDeleted: true,
            deletedBy: currentUser.username,
            deletedAt: Date.now()
        });
        window.showToast("Whisper erased from archives.");
    } catch(e) {
        window.showToast("Failed to delete whisper.");
    }
};

window.promptBlockUser = (uid, name) => {
    if (confirm(`Block ${name}? You will no longer see their messages or receive whispers from them.`)) {
        executeBlockUser(uid);
    }
};

window.confirmBlockUser = () => {
    if (!window.pendingDmTarget) return;
    executeBlockUser(window.pendingDmTarget.id);
    document.getElementById('dm-confirm-modal').classList.add('hidden');
    window.pendingDmTarget = null;
};

async function executeBlockUser(uid) {
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            blockedUsers: arrayUnion(uid)
        });
        if (!currentUser.blockedUsers) currentUser.blockedUsers = [];
        currentUser.blockedUsers.push(uid);
        
        if (window.activeChatTargetId === uid) window.closeActiveDM();
        window.showToast("User blocked.");
        if (window.renderGlobalChat) window.renderGlobalChat();
    } catch(e) {
        window.showToast("Failed to block user.");
    }
}

window.openUsernameModal = () => {
    const isForced = !currentUser.username || currentUser.username.trim() === '' || !currentUser.ageCategory;
    document.getElementById('missing-username-input').value = currentUser.username || '';
    
    if (currentUser.ageCategory) {
        document.getElementById('missing-age-input').value = currentUser.ageCategory;
    }
    
    document.getElementById('close-username-modal').classList.toggle('hidden', isForced);
    document.getElementById('username-modal-desc').innerText = isForced 
        ? "The archives require your identity and age verification, traveler. Please complete your profile."
        : "By what new title shall the realm know you?";
    document.getElementById('username-prompt-modal').classList.remove('hidden');
};

window.setUsername = async () => {
    const newName = document.getElementById('missing-username-input').value.trim();
    const ageCat = document.getElementById('missing-age-input').value;
    
    if (!newName) return window.showToast("Please enter a name.");
    if (!ageCat) return window.showToast("Please verify your age group.");
    
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            username: newName,
            ageCategory: ageCat
        });
        currentUser.username = newName;
        currentUser.ageCategory = ageCat;
        document.getElementById('user-display-name').innerText = newName;
        document.getElementById('username-prompt-modal').classList.add('hidden');
        
        if (ageCat === 'under_17') {
            const allianceBtn = document.getElementById('btn-form-alliance');
            if(allianceBtn) allianceBtn.classList.add('hidden');
        }
        
        if (window.renderGlobalChat) window.renderGlobalChat();
        if (window.initDirectMessaging) window.initDirectMessaging();
        window.showToast("Profile updated!");
    } catch (err) {
        console.error(err);
        window.showToast("Failed to save profile.");
    }
};

window.initFriendsSync = () => {
    if (friendsUnsub) friendsUnsub();
    if (reqsUnsub) reqsUnsub();

    friendsUnsub = onSnapshot(collection(db, 'artifacts', 'global_chat', 'public', 'data', `friends_of_${currentUser.uid}`), (snap) => {
        window.myFriends = snap.docs.map(d => ({id: d.id, ...d.data()}));
        if(!document.getElementById('friends-modal').classList.contains('hidden')) window.renderFriendsList();
    });

    reqsUnsub = onSnapshot(collection(db, 'artifacts', 'global_chat', 'public', 'data', `friend_reqs_for_${currentUser.uid}`), (snap) => {
        window.myFriendRequests = snap.docs.map(d => ({id: d.id, ...d.data()}));
        
        const badge = document.getElementById('global-friends-badge');
        const tabBadge = document.getElementById('req-tab-badge');
        
        if (window.myFriendRequests.length > 0) {
            badge.innerText = window.myFriendRequests.length;
            badge.classList.remove('hidden');
            tabBadge.innerText = window.myFriendRequests.length;
            tabBadge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
            tabBadge.classList.add('hidden');
        }
        
        if(!document.getElementById('friends-modal').classList.contains('hidden')) window.renderFriendRequests();
    });
};

window.openFriendsModal = () => {
    window.switchFriendTab('list');
    document.getElementById('friends-modal').classList.remove('hidden');
};

window.switchFriendTab = (tab) => {
    document.getElementById('tab-friends-list').className = "flex-1 py-1 font-heading font-bold text-ink hover:text-blood transition text-[10px] uppercase tracking-widest";
    document.getElementById('tab-friends-reqs').className = "flex-1 py-1 font-heading font-bold text-ink hover:text-blood transition text-[10px] uppercase tracking-widest relative";
    document.getElementById('tab-friends-search').className = "flex-1 py-1 font-heading font-bold text-ink hover:text-blood transition text-[10px] uppercase tracking-widest";
    
    document.getElementById('friends-view-list').classList.add('hidden');
    document.getElementById('friends-view-reqs').classList.add('hidden');
    document.getElementById('friends-view-search').classList.add('hidden');
    
    if (tab === 'list') {
        document.getElementById('tab-friends-list').className = "flex-1 py-1 font-heading font-bold text-blood border-b-2 border-blood text-[10px] uppercase tracking-widest";
        document.getElementById('friends-view-list').classList.remove('hidden');
        window.renderFriendsList();
    } else if (tab === 'reqs') {
        document.getElementById('tab-friends-reqs').className = "flex-1 py-1 font-heading font-bold text-blood border-b-2 border-blood text-[10px] uppercase tracking-widest relative";
        document.getElementById('friends-view-reqs').classList.remove('hidden');
        window.renderFriendRequests();
    } else if (tab === 'search') {
        document.getElementById('tab-friends-search').className = "flex-1 py-1 font-heading font-bold text-blood border-b-2 border-blood text-[10px] uppercase tracking-widest";
        document.getElementById('friends-view-search').classList.remove('hidden');
    }
};

window.renderFriendsList = () => {
    const container = document.getElementById('friends-view-list');
    if (window.myFriends.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-500 italic text-center py-4">Your ledger is empty.</p>`;
    } else {
        container.innerHTML = window.myFriends.map(f => `
            <div class="flex justify-between items-center p-3 bg-white/40 border border-gray-300 rounded shadow-sm">
                <span class="font-heading font-bold text-ink text-sm uppercase tracking-widest">${f.name}</span>
                <div class="flex gap-3">
                    <button onclick="document.getElementById('friends-modal').classList.add('hidden'); window.promptDirectMessage('${f.id}', '${f.name.replace(/'/g, "\\'")}')" class="text-gray-600 hover:text-gold transition-colors" title="Message"><i class="fa-solid fa-comment"></i></button>
                    <button onclick="window.removeFriend('${f.id}')" class="text-gray-600 hover:text-red-500 transition-colors" title="Remove Friend"><i class="fa-solid fa-user-minus"></i></button>
                </div>
            </div>
        `).join('');
    }
};

window.renderFriendRequests = () => {
    const container = document.getElementById('friends-view-reqs');
    if (window.myFriendRequests.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-500 italic text-center py-4">No pending requests.</p>`;
    } else {
        container.innerHTML = window.myFriendRequests.map(r => `
            <div class="flex justify-between items-center p-3 bg-white/40 border border-gold rounded shadow-sm">
                <span class="font-heading font-bold text-ink text-sm uppercase tracking-widest">${r.name}</span>
                <div class="flex gap-2">
                    <button onclick="window.acceptFriendRequest('${r.id}', '${r.name.replace(/'/g, "\\'")}')" class="bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded shadow text-[10px] font-bold uppercase tracking-widest"><i class="fa-solid fa-check"></i></button>
                    <button onclick="window.declineFriendRequest('${r.id}')" class="bg-gray-400 hover:bg-red-500 text-white px-2 py-1 rounded shadow text-[10px] font-bold uppercase tracking-widest"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>
        `).join('');
    }
};

window.searchUsersForFriend = async () => {
    const queryText = document.getElementById('friend-search-input').value.trim().toLowerCase();
    if (!queryText) return window.showToast("Enter a name to search.");
    
    try {
        const snap = await getDocs(collection(db, 'users'));
        const results = snap.docs
            .map(d => ({id: d.id, ...d.data()}))
            .filter(u => u.uid !== currentUser.uid && u.username && u.username.toLowerCase().includes(queryText) && !isUserBlocked(u.uid) && window.isAllowedContact(u.uid));
            
        const list = document.getElementById('friend-search-results');
        
        if (results.length === 0) {
            list.innerHTML = `<p class="text-xs text-gray-500 italic text-center py-4">No travelers found by that name.</p>`;
        } else {
            list.innerHTML = results.map(u => {
                const isFriend = window.myFriends.some(f => f.id === u.uid);
                return `
                <div class="flex justify-between items-center p-2 border-b border-gray-300">
                    <span class="font-heading font-bold text-ink text-sm uppercase tracking-widest">${u.username}</span>
                    ${isFriend ? `<span class="text-[10px] text-green-700 font-bold uppercase tracking-widest"><i class="fa-solid fa-check mr-1"></i>Friend</span>` 
                    : `<button onclick="window.sendFriendRequest('${u.uid}', '${u.username.replace(/'/g, "\\'")}')" class="text-gold hover:text-ink transition-colors"><i class="fa-solid fa-user-plus"></i></button>`}
                </div>
                `;
            }).join('');
        }
    } catch (e) {
        console.error(e);
        window.showToast("Search failed.");
    }
};

window.sendFriendRequestFromModal = () => {
    if (!window.pendingDmTarget) return;
    window.sendFriendRequest(window.pendingDmTarget.id, window.pendingDmTarget.name);
    document.getElementById('dm-confirm-modal').classList.add('hidden');
    window.pendingDmTarget = null;
};

window.sendFriendRequest = async (targetUid, targetName) => {
    if (isUserBlocked(targetUid)) return window.showToast("Cannot add blocked user.");
    if (!window.isAllowedContact(targetUid)) return window.showToast("Safety Restriction: You may only friend your Dungeon Master.");
    if (window.myFriends.some(f => f.id === targetUid)) return window.showToast("Already on your ledger.");
    
    window.showToast("Sending request...");
    try {
        await setDoc(doc(db, 'artifacts', 'global_chat', 'public', 'data', `friend_reqs_for_${targetUid}`, currentUser.uid), {
            name: currentUser.username,
            timestamp: Date.now()
        });
        window.showToast("Request sent!");
    } catch (e) {
        console.error(e);
        window.showToast("Failed to send request.");
    }
};

window.acceptFriendRequest = async (targetUid, targetName) => {
    try {
        await deleteDoc(doc(db, 'artifacts', 'global_chat', 'public', 'data', `friend_reqs_for_${currentUser.uid}`, targetUid));
        await setDoc(doc(db, 'artifacts', 'global_chat', 'public', 'data', `friends_of_${currentUser.uid}`, targetUid), { name: targetName });
        await setDoc(doc(db, 'artifacts', 'global_chat', 'public', 'data', `friends_of_${targetUid}`, currentUser.uid), { name: currentUser.username });
        window.showToast("Added to Ledger.");
    } catch(e) {
        console.error(e);
        window.showToast("Error accepting request.");
    }
};

window.declineFriendRequest = async (targetUid) => {
    try {
        await deleteDoc(doc(db, 'artifacts', 'global_chat', 'public', 'data', `friend_reqs_for_${currentUser.uid}`, targetUid));
    } catch(e) {}
};

window.removeFriend = async (targetUid) => {
    if(!confirm("Remove this traveler from your ledger?")) return;
    try {
        await deleteDoc(doc(db, 'artifacts', 'global_chat', 'public', 'data', `friends_of_${currentUser.uid}`, targetUid));
        await deleteDoc(doc(db, 'artifacts', 'global_chat', 'public', 'data', `friends_of_${targetUid}`, currentUser.uid));
        window.showToast("Traveler removed.");
    } catch(e) {}
};

window.pendingGroupMembers = [];

window.openCreateGroupModal = () => {
    if (currentUser && currentUser.ageCategory === 'under_17') {
        return window.showToast("Safety Restriction: Alliances are disabled for your age group.");
    }
    window.pendingGroupMembers = [];
    document.getElementById('new-group-name').value = '';
    
    const listContainer = document.getElementById('group-friends-list');
    
    if (window.myFriends.length === 0) {
        listContainer.innerHTML = '<p class="text-[10px] text-gray-600 italic text-center py-4">You have no friends on your ledger. Add some first to form an alliance!</p>';
    } else {
        listContainer.innerHTML = window.myFriends.map(f => `
            <div class="flex justify-between items-center p-2 hover:bg-black/10 border-b border-gray-300 last:border-0">
                <span class="text-xs font-heading font-bold text-ink uppercase tracking-widest">${f.name}</span>
                <button onclick="window.addGroupMember('${f.id}', '${f.name.replace(/'/g, "\\'")}')" class="text-green-700 hover:text-green-900 transition-colors"><i class="fa-solid fa-plus"></i></button>
            </div>
        `).join('');
    }
    
    window.renderSelectedGroupMembers();
    document.getElementById('create-group-modal').classList.remove('hidden');
};

window.closeCreateGroupModal = () => {
    document.getElementById('create-group-modal').classList.add('hidden');
};

window.addGroupMember = (uid, name) => {
    if (!window.pendingGroupMembers.find(m => m.id === uid)) {
        window.pendingGroupMembers.push({ id: uid, name: name });
        window.renderSelectedGroupMembers();
    }
};

window.removeGroupMember = (uid) => {
    window.pendingGroupMembers = window.pendingGroupMembers.filter(m => m.id !== uid);
    window.renderSelectedGroupMembers();
};

window.renderSelectedGroupMembers = () => {
    const container = document.getElementById('selected-group-members');
    if (window.pendingGroupMembers.length === 0) {
        container.innerHTML = `<span class="text-xs text-gray-500 italic w-full text-center py-2">No one selected...</span>`;
        return;
    }
    container.innerHTML = window.pendingGroupMembers.map(m => `
        <span class="bg-indigo-900 text-white text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded shadow-md flex items-center gap-1">
            ${m.name} <i class="fa-solid fa-xmark cursor-pointer hover:text-red-400 ml-1 border-l border-indigo-700 pl-1" onclick="window.removeGroupMember('${m.id}')"></i>
        </span>
    `).join('');
};

window.confirmCreateGroup = async () => {
    if (window.pendingGroupMembers.length === 0) {
        return window.showToast("Select at least one friend first!");
    }
    
    const createBtn = document.getElementById('btn-confirm-create-group');
    if(createBtn) {
        createBtn.innerText = "Creating...";
        createBtn.disabled = true;
    }
    
    let groupName = document.getElementById('new-group-name').value.trim();
    if (!groupName) {
        groupName = "Alliance: " + window.pendingGroupMembers.map(m => m.name).join(', ');
        if (groupName.length > 30) groupName = groupName.substring(0, 30) + '...';
    }

    const groupId = 'group_' + Date.now() + Math.random().toString(36).substring(2, 8);
    const groupDocRef = doc(db, 'artifacts', 'global_chat', 'public', 'data', 'groups', groupId);
    
    const members = [currentUser.uid, ...window.pendingGroupMembers.map(m => m.id)];
    const now = Date.now();

    window.showToast("Forming alliance...");
    
    try {
        await setDoc(groupDocRef, {
            name: groupName,
            members: members,
            createdAt: now,
            createdBy: currentUser.uid
        });

        for (const uid of members) {
            await setDoc(doc(db, 'artifacts', 'global_chat', 'public', 'data', `dm_contacts_${uid}`, groupId), {
                name: groupName,
                isGroup: true,
                members: members,
                lastMessage: "Alliance formed.",
                lastUpdated: now,
                unreadCount: uid === currentUser.uid ? 0 : 1
            });
        }
        
        await addDoc(collection(db, 'artifacts', 'global_chat', 'public', 'data', `dm_messages_${groupId}`), {
            text: `${currentUser.username} established the alliance.`,
            authorId: 'system',
            timestamp: now
        });

        if(createBtn) {
            createBtn.innerText = "Create";
            createBtn.disabled = false;
        }
        window.closeCreateGroupModal();
        window.showToast("Group created!");
        window.openDirectMessage(groupId, groupName, true, members.join(','));
    } catch (e) {
        console.error(e);
        window.showToast("Failed to create group.");
        if(createBtn) {
            createBtn.innerText = "Create";
            createBtn.disabled = false;
        }
    }
};

window.renameGroup = async () => {
    if (!window.activeChatIsGroup) return;
    const newName = prompt("Enter new group name:", window.activeChatTargetName);
    if (!newName || newName.trim() === '') return;
    
    window.showToast("Renaming group...");
    try {
        await updateDoc(doc(db, 'artifacts', 'global_chat', 'public', 'data', 'groups', window.activeChatTargetId), { name: newName.trim() });

        const promises = window.activeChatMembers.map(async (uid) => {
             try {
                await updateDoc(doc(db, 'artifacts', 'global_chat', 'public', 'data', `dm_contacts_${uid}`, window.activeChatTargetId), {
                    name: newName.trim()
                });
             } catch(e) {}
        });
        await Promise.all(promises);
        
        await addDoc(collection(db, 'artifacts', 'global_chat', 'public', 'data', `dm_messages_${window.activeChatTargetId}`), {
            text: `${currentUser.username} renamed the alliance to "${newName.trim()}".`,
            authorId: 'system',
            timestamp: Date.now()
        });

        document.getElementById('active-dm-name').innerText = newName.trim();
        window.activeChatTargetName = newName.trim();
        window.showToast("Group renamed.");
    } catch(e) {
        console.error(e);
        window.showToast("Failed to rename group.");
    }
};

window.deleteGroup = async () => {
    if (!window.activeChatIsGroup) return;
    if (!confirm("Are you sure you want to permanently obliterate this alliance for all members?")) return;
    
    window.showToast("Destroying alliance...");
    try {
        await deleteDoc(doc(db, 'artifacts', 'global_chat', 'public', 'data', 'groups', window.activeChatTargetId));

        const promises = window.activeChatMembers.map(async (uid) => {
             try {
                await deleteDoc(doc(db, 'artifacts', 'global_chat', 'public', 'data', `dm_contacts_${uid}`, window.activeChatTargetId));
             } catch(e) {}
        });
        await Promise.all(promises);
        
        window.closeActiveDM();
        window.showToast("Group deleted.");
    } catch(e) {
        console.error(e);
        window.showToast("Failed to delete group.");
    }
};

window.pendingReportData = null;

window.promptReportUser = (uid, username, msgSnippet) => {
    if (currentUser && uid === currentUser.uid) return window.showToast("You cannot report yourself.");
    window.pendingReportData = { reportedId: uid, reportedName: username, snippet: msgSnippet };
    document.getElementById('report-target-name').innerText = username;
    document.getElementById('report-reason').value = '';
    document.getElementById('report-modal').classList.remove('hidden');
};

window.submitReport = async () => {
    const reason = document.getElementById('report-reason').value.trim();
    if (!reason) return window.showToast("Please provide a reason.");
    if (!window.pendingReportData) return;

    document.getElementById('report-modal').classList.add('hidden');
    window.showToast("Submitting report...");

    try {
        await addDoc(collection(db, 'artifacts', 'global_chat', 'public', 'data', 'reports'), {
            reportedId: window.pendingReportData.reportedId,
            reportedName: window.pendingReportData.reportedName,
            reporterId: currentUser.uid,
            reporterName: currentUser.username,
            reason: reason,
            messageSnippet: window.pendingReportData.snippet,
            status: 'pending',
            timestamp: Date.now()
        });
        window.showToast("Report submitted to Archives.");
    } catch (err) {
        console.error(err);
        window.showToast("Failed to submit report.");
    }
    window.pendingReportData = null;
};

let reportsUnsub = null;
window.initAdminReports = () => {
    if (reportsUnsub) reportsUnsub();
    reportsUnsub = onSnapshot(collection(db, 'artifacts', 'global_chat', 'public', 'data', 'reports'), (snap) => {
        const reports = snap.docs.map(d => ({id: d.id, ...d.data()})).filter(r => r.status === 'pending').sort((a,b) => b.timestamp - a.timestamp);
        const container = document.getElementById('reports-list-container');
        const badge = document.getElementById('report-tab-badge');

        if (reports.length > 0) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }

        if (!container) return;

        if (reports.length === 0) {
            container.innerHTML = `<p class="text-xs text-gray-500 italic text-center py-4">No pending reports.</p>`;
        } else {
            container.innerHTML = reports.map(r => `
                <div class="bg-black/40 border border-red-900/50 p-3 rounded mb-3">
                    <div class="flex justify-between items-start mb-2 border-b border-red-900/30 pb-2">
                        <div>
                            <h4 class="font-heading text-sm font-bold text-red-500 uppercase tracking-widest">Report: ${r.reportedName}</h4>
                            <p class="text-[9px] text-gray-500 uppercase font-heading">By ${r.reporterName} • ${window.formatChatTime(r.timestamp)}</p>
                        </div>
                    </div>
                    <p class="text-xs text-gray-300 font-serif mb-2"><strong class="text-gray-500">Reason:</strong> ${r.reason}</p>
                    ${r.messageSnippet ? `<p class="text-[10px] text-gray-500 font-serif italic mb-3 bg-black/50 p-2 border-l-2 border-gray-600">"${r.messageSnippet}..."</p>` : ''}
                    <div class="flex gap-2 justify-end mt-2">
                        <button onclick="window.resolveReport('${r.id}')" class="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded border border-gray-600 transition-colors uppercase font-bold tracking-widest font-heading">Dismiss</button>
                        <button onclick="window.promptEscalation('${r.id}', '${r.reportedId}', '${r.reportedName.replace(/'/g, "\\'")}')" class="text-[10px] bg-red-900 hover:bg-red-800 text-white px-3 py-1 rounded border border-red-500 transition-colors uppercase font-bold tracking-widest font-heading">Review & Penalize</button>
                    </div>
                </div>
            `).join('');
        }
    });
};

window.resolveReport = async (reportId) => {
    try {
        await updateDoc(doc(db, 'artifacts', 'global_chat', 'public', 'data', 'reports', reportId), { status: 'resolved' });
        window.showToast("Report dismissed.");
    } catch (e) {
        console.error(e);
    }
};

window.promptEscalation = (reportId, uid, username) => {
    document.getElementById('escalation-report-id').value = reportId;
    document.getElementById('escalation-uid').value = uid;
    document.getElementById('escalation-username').value = username;
    document.getElementById('admin-escalation-modal').classList.remove('hidden');
};

const executePenalty = async (type, hours = 0) => {
    const reportId = document.getElementById('escalation-report-id').value;
    const uid = document.getElementById('escalation-uid').value;
    const username = document.getElementById('escalation-username').value;
    
    document.getElementById('admin-escalation-modal').classList.add('hidden');
    window.showToast("Applying penalty...");
    
    try {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        const currentStrikes = userSnap.exists() ? (userSnap.data().strikes || 0) : 0;
        
        let notificationMsg = "";
        let updates = { strikes: currentStrikes + 1 };
        
        if (type === 'warn') {
            notificationMsg = "You have received a formal warning from the Archives due to a violation of conduct. Further offenses will result in a mute.";
        } else if (type === 'mute') {
            const muteUntil = Date.now() + (hours * 60 * 60 * 1000);
            updates.mutedUntil = muteUntil;
            notificationMsg = `You have been silenced by the Archives for ${hours} hour(s) due to a violation of conduct.`;
        } else if (type === 'ban') {
            updates.isBanned = true;
            notificationMsg = "You have been permanently banished from communications and joining new realms due to severe or repeated violations.";
        }
        
        updates.notifications = arrayUnion({
            type: type === 'ban' ? 'BANNED' : 'MODERATION ACTION',
            itemName: 'System Notice',
            message: notificationMsg,
            timestamp: Date.now()
        });
        
        await updateDoc(userRef, updates);
        await window.resolveReport(reportId);
        window.showToast(`Penalty applied to ${username}.`);
        
    } catch(e) {
        console.error(e);
        window.showToast("Failed to apply penalty.");
    }
};

window.issueWarning = () => executePenalty('warn');
window.issueMute = (hours) => executePenalty('mute', hours);
window.issueBan = () => executePenalty('ban');

const getIncludedArchivesHTML = (pack) => {
    const included = [];
    if (pack.scripts?.length > 0) included.push('Script Codex');
    if (pack.vocations?.length > 0) included.push('Vocations');
    if (pack.subvocations?.length > 0) included.push('Sub-Vocations');
    if (pack.lineages?.length > 0) included.push('Lineages');
    if (pack.backgrounds?.length > 0) included.push('Backgrounds');
    if (pack.bestiary?.length > 0) included.push('Bestiary');
    if (pack.npcs?.length > 0) included.push('NPCs');
    if (pack.gearArtifacts?.length > 0) included.push('Artifacts');
    if (pack.worldlore?.length > 0) included.push('World Lore');
    if (pack.howtoplay?.length > 0) included.push('How to Play');
    if (pack.archivistLibrary?.length > 0) included.push('Archivist Lib.');
    if (pack.custodiansAthenaeum?.length > 0) included.push('Custodian Lib.');
    if (pack.maps?.length > 0) included.push('Maps');
    if (pack.landmarks?.length > 0) included.push('Landmarks');

    if (included.length === 0) return '<span class="text-gray-500 italic text-[10px]">None selected.</span>';
    
    return included.map(item => `<span class="inline-block bg-wood text-gray-400 border border-gray-600 px-2 py-0.5 rounded text-[8px] uppercase tracking-widest font-heading shadow-sm">${item}</span>`).join(' ');
};

const getTotalItems = (p) => {
    return (p.scripts?.length||0) + (p.landmarks?.length||0) + (p.archivistLibrary?.length||0) + 
           (p.backgrounds?.length||0) + (p.worldlore?.length||0) + (p.bestiary?.length||0) + 
           (p.npcs?.length||0) + (p.vocations?.length||0) + (p.lineages?.length||0) + 
           (p.howtoplay?.length||0) + (p.gearArtifacts?.length||0) + (p.custodiansAthenaeum?.length||0) +
           (p.maps?.length||0);
};

window.openPacksModal = () => {
    const grid = document.getElementById('packs-grid');
    grid.innerHTML = '';

    if (allFetchedPacks.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-8 text-center"><p class="text-gray-400 font-serif italic">No packs found in the archives.</p></div>`;
    } else {
        grid.innerHTML = allFetchedPacks.map(pack => {
            const iconClass = pack.icon || 'fa-solid fa-book-journal-whills';
            const downloadCount = pack.downloads || 0;
            return `
            <div class="card p-5 rounded-lg flex flex-col relative bg-black/60 border border-gray-700 ${pack.isDeleted ? 'opacity-70 grayscale' : ''}" onclick="window.openPackDetails('${pack.id}')">
                ${pack.isDeleted ? '<div class="absolute top-2 left-2 bg-red-900 text-white px-2 py-0.5 rounded text-[8px] uppercase tracking-widest font-heading shadow-md z-10">Archived</div>' : ''}
                ${pack.isPrivate ? '<div class="absolute top-2 right-2 text-gray-500" title="Private Pack"><i class="fa-solid fa-lock text-xs"></i></div>' : '<div class="absolute top-2 right-2 text-indigo-400" title="Public Pack"><i class="fa-solid fa-globe text-xs"></i></div>'}
                <i class="${iconClass} text-3xl mb-3 ${pack.isDeleted ? 'text-gray-500' : 'text-gold'}"></i>
                <h3 class="font-heading text-sm font-bold text-white uppercase mb-1 drop-shadow-md">${pack.name}</h3>
                <p class="text-xs text-gray-400 mb-3 line-clamp-3 font-serif">${pack.description || 'No description provided.'}</p>
                <div class="border-t border-gray-700 pt-2 flex flex-col mt-auto gap-1">
                    <div class="flex justify-between items-center">
                        <span class="text-[9px] text-gold font-bold uppercase tracking-widest">v${pack.version || 1} • Records: ${getTotalItems(pack)}</span>
                        <span class="text-[9px] text-gray-500 italic">By ${pack.authorName || 'Unknown'}</span>
                    </div>
                    <div class="flex justify-start items-center text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                        <i class="fa-solid fa-download mr-1"></i> ${downloadCount} Downloads
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }
    document.getElementById('packs-modal').classList.remove('hidden');
};

window.openPackDetails = (id) => {
    currentViewingPack = allFetchedPacks.find(p => p.id === id);
    if (!currentViewingPack) return;
    
    if (currentViewingPack.isDeleted) {
        document.getElementById('pd-title').innerHTML = `${currentViewingPack.name} <span class="text-[10px] bg-red-900 text-white px-2 py-1 rounded ml-2 align-middle shadow-md tracking-widest">ARCHIVED</span>`;
    } else {
        document.getElementById('pd-title').innerText = currentViewingPack.name;
    }
    
    document.getElementById('pd-author').innerText = `By ${currentViewingPack.authorName}`;
    document.getElementById('pd-version').innerText = `v${currentViewingPack.version || 1}`;
    document.getElementById('pd-downloads').innerHTML = `<i class="fa-solid fa-download mr-1"></i>${currentViewingPack.downloads || 0}`;
    document.getElementById('pd-desc').innerText = currentViewingPack.description || 'No description provided.';
    document.getElementById('pd-notes').innerText = currentViewingPack.updateNotes || 'Initial publication.';
    
    const archivesContainer = document.getElementById('pd-included-archives');
    if (archivesContainer) archivesContainer.innerHTML = getIncludedArchivesHTML(currentViewingPack);

    const pdOwnerPanel = document.getElementById('pd-owner-panel');
    if (pdOwnerPanel) {
        pdOwnerPanel.classList.toggle('hidden', !adminModeActive);
    }

    const isAdmin = currentViewingPack.authorId === currentUser.uid;
    
    if (isAdmin || adminModeActive) {
        const adminPanel = document.getElementById('pd-admin-panel');
        if (adminPanel) adminPanel.classList.remove('hidden');
        
        const isArchived = currentViewingPack.isDeleted;
        
        const archiveBtn = document.getElementById('pd-btn-archive');
        const unarchiveBtn = document.getElementById('pd-btn-unarchive');
        const permDelBtn = document.getElementById('pd-admin-perm-delete');
        
        if (archiveBtn) archiveBtn.classList.toggle('hidden', isArchived);
        if (unarchiveBtn) unarchiveBtn.classList.toggle('hidden', !isArchived);
        if (permDelBtn) permDelBtn.classList.remove('hidden');
    } else {
        const adminPanel = document.getElementById('pd-admin-panel');
        if (adminPanel) adminPanel.classList.add('hidden');
    }

    const campaignsList = document.getElementById('pd-campaigns-list');
    const relatedCamps = allCampaigns.filter(c => c.packName === currentViewingPack.name && c.visibility === 'public');
    
    if (relatedCamps.length === 0) {
        campaignsList.innerHTML = `<p class="text-xs text-gray-500 italic font-serif bg-black/30 p-3 rounded">No public realms are currently using this codex.</p>`;
    } else {
        campaignsList.innerHTML = relatedCamps.map(camp => {
            const joinedIds = currentUser?.joinedCampaigns || [];
            const isJoined = joinedIds.includes(camp.id) || camp.dmId === currentUser.uid;
            
            let actionBtn = '';
            if (isJoined) {
                actionBtn = `<span class="text-[10px] text-green-500 font-bold uppercase tracking-widest"><i class="fa-solid fa-check mr-1"></i>Joined</span>`;
            } else if (currentUser.role === 'player') {
                actionBtn = `<button onclick="window.joinPublicCampaign('${camp.id}', '${camp.name.replace(/'/g, "\\'")}')" class="bg-gray-800 hover:bg-gray-700 text-gold px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-colors border border-gray-600">Join Realm</button>`;
            } else {
                actionBtn = `<span class="text-[10px] text-gray-600 uppercase tracking-widest">DM Locked</span>`;
            }

            return `
            <div class="bg-black/40 border border-gray-700 p-3 rounded flex justify-between items-center transition-colors hover:border-gray-500">
                <div>
                    <h4 class="text-sm font-bold text-white font-heading">${camp.name}</h4>
                    <p class="text-[10px] text-gray-400 italic font-serif">Run by ${camp.dmName}</p>
                </div>
                <div>${actionBtn}</div>
            </div>
            `;
        }).join('');
    }

    if (currentUser.role === 'dm') {
        document.getElementById('pd-right-col').classList.remove('hidden');
        document.getElementById('pd-right-col-player').classList.add('hidden');
        
        const pathArgs = currentViewingPack.isPrivate
            ? ['artifacts', 'global_codex', 'users', currentViewingPack.authorId, 'scriptPacks', id, 'messages']
            : ['artifacts', 'global_codex', 'public', 'data', 'scriptPacks', id, 'messages'];

        if (packMessagesUnsubscribe) packMessagesUnsubscribe();
        packMessagesUnsubscribe = onSnapshot(collection(db, ...pathArgs), (snap) => {
            const msgs = snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => a.timestamp - b.timestamp);
            const container = document.getElementById('pd-messages-container');
            
            if (msgs.length === 0) {
                container.innerHTML = `<div class="text-center py-4 text-xs italic text-gray-500">No messages yet. Start the discussion!</div>`;
            } else {
                container.innerHTML = msgs.map(m => {
                    if (isUserBlocked(m.authorId)) return '';

                    const isMe = m.authorId === currentUser.uid;
                    const deleteBtn = (adminModeActive && !m.isDeleted) ? `<button onclick="window.deletePackMessage('${m.id}')" class="text-gray-600 hover:text-red-500 transition-colors ml-2" title="Delete Message"><i class="fa-solid fa-trash-can"></i></button>` : '';
                    const reportBtn = (!isMe && !m.isDeleted) ? `<button onclick="window.promptReportUser('${m.authorId}', '${m.authorName.replace(/'/g, "\\'")}', '${m.text.replace(/'/g, "\\'").replace(/"/g, '&quot;').substring(0, 50)}')" class="text-gray-500 hover:text-yellow-500 ml-2" title="Report User"><i class="fa-solid fa-flag"></i></button>` : '';

                    let msgContent = m.text;
                    let deletedClass = '';
                    
                    if (m.isDeleted) {
                        if (adminModeActive) {
                            deletedClass = 'deleted-msg-admin';
                            msgContent = `<span class="text-red-500 font-bold uppercase text-[9px] block mb-1">Deleted by ${m.deletedBy}</span>` + m.text;
                        } else {
                            return `<div class="p-3 bg-black/40 rounded border border-gray-700 relative group"><p class="text-[10px] text-gray-600 italic">This message was removed by the archives.</p></div>`;
                        }
                    }

                    return `
                    <div class="p-3 bg-black/40 rounded border border-gray-700 relative group ${deletedClass}">
                        <div class="flex justify-between items-start text-[10px] font-heading mb-1 border-b border-gray-700 pb-1">
                            <span class="${m.authorId === currentViewingPack.authorId ? 'text-indigo-400' : 'text-gold'} font-bold uppercase">${m.authorName} ${m.authorId === currentViewingPack.authorId ? '<i class="fa-solid fa-crown ml-1" title="Pack Author"></i>' : ''}</span>
                            <div class="flex items-center">
                                <span class="text-gray-500">${new Date(m.timestamp).toLocaleDateString()}</span>
                                ${reportBtn}
                                ${deleteBtn}
                            </div>
                        </div>
                        <p class="text-sm font-serif text-gray-300 break-words mt-2">${msgContent}</p>
                    </div>
                    `;
                }).join('');
                container.scrollTop = container.scrollHeight;
            }
        });
    } else {
        document.getElementById('pd-right-col').classList.add('hidden');
        document.getElementById('pd-right-col-player').classList.remove('hidden');
    }

    document.getElementById('pack-details-modal').classList.remove('hidden');
};

window.closePackDetails = () => {
    document.getElementById('pack-details-modal').classList.add('hidden');
    if (packMessagesUnsubscribe) { packMessagesUnsubscribe(); packMessagesUnsubscribe = null; }
    currentViewingPack = null;
};

window.postPackMessage = async () => {
    const input = document.getElementById('pd-new-message');
    const text = input.value.trim();
    if (!text || !currentViewingPack || currentUser.role !== 'dm') return;
    
    if (!checkRateLimit(text)) return;
    
    input.value = '';
    
    const pathArgs = currentViewingPack.isPrivate
        ? ['artifacts', 'global_codex', 'users', currentViewingPack.authorId, 'scriptPacks', currentViewingPack.id, 'messages']
        : ['artifacts', 'global_codex', 'public', 'data', 'scriptPacks', currentViewingPack.id, 'messages'];
        
    try {
        await addDoc(collection(db, ...pathArgs), {
            text: text, authorId: currentUser.uid, authorName: currentUser.username, timestamp: Date.now()
        });
    } catch (err) {
        console.error("Failed to post message", err);
        window.showToast("Failed to send message.");
    }
};

window.deletePackMessage = async (msgId) => {
    if (!currentViewingPack || !adminModeActive) return;
    if (!confirm("Erase this message from the archives?")) return;
    
    const pathArgs = currentViewingPack.isPrivate
        ? ['artifacts', 'global_codex', 'users', currentViewingPack.authorId, 'scriptPacks', currentViewingPack.id, 'messages', msgId]
        : ['artifacts', 'global_codex', 'public', 'data', 'scriptPacks', currentViewingPack.id, 'messages', msgId];
        
    try {
        await deleteDoc(doc(db, ...pathArgs));
        window.showToast("Message erased.");
    } catch(e) {
        console.error("Failed to delete message", e);
        window.showToast("Failed to erase message.");
    }
};

window.deleteCurrentPack = async (permanent = false) => {
    if (!currentViewingPack || (currentViewingPack.authorId !== currentUser.uid && !adminModeActive)) return;
    
    if (permanent) {
        if (!confirm("Are you sure you want to permanently delete this pack? This cannot be undone.")) return;
        
        const pathArgs = currentViewingPack.isPrivate 
            ? ['artifacts', 'global_codex', 'users', currentViewingPack.authorId, 'scriptPacks', currentViewingPack.id]
            : ['artifacts', 'global_codex', 'public', 'data', 'scriptPacks', currentViewingPack.id];
        try {
            await deleteDoc(doc(db, ...pathArgs));
            window.showToast("Pack permanently deleted.");
            window.closePackDetails();
            if (window.openPacksModal) window.openPacksModal();
        } catch (e) {
            console.error(e);
            window.showToast("Failed to delete pack.");
        }
        return;
    }
    
    if (!confirm("Archive this pack? It will no longer receive updates, but existing campaigns will keep their records.")) return;
    
    const pathArgs = currentViewingPack.isPrivate 
        ? ['artifacts', 'global_codex', 'users', currentUser.uid, 'scriptPacks', currentViewingPack.id]
        : ['artifacts', 'global_codex', 'public', 'data', 'scriptPacks', currentViewingPack.id];
        
    try {
        await updateDoc(doc(db, ...pathArgs), {
            isDeleted: true,
            updateNotes: 'Pack archived by author. No longer receiving updates.',
            updatedAt: Date.now()
        });
        window.showToast("Pack archived.");
        window.closePackDetails();
        if (window.openPacksModal) window.openPacksModal();
    } catch (e) {
        console.error(e);
        window.showToast("Failed to archive pack.");
    }
};

window.unarchiveCurrentPack = async () => {
    if (!currentViewingPack || (currentViewingPack.authorId !== currentUser.uid && !adminModeActive)) return;
    
    if (!confirm("Unarchive this pack? It will be visible and updateable again.")) return;
    
    const pathArgs = currentViewingPack.isPrivate 
        ? ['artifacts', 'global_codex', 'users', currentViewingPack.authorId, 'scriptPacks', currentViewingPack.id]
        : ['artifacts', 'global_codex', 'public', 'data', 'scriptPacks', currentViewingPack.id];
        
    try {
        await updateDoc(doc(db, ...pathArgs), {
            isDeleted: false,
            updateNotes: 'Pack unarchived by author.',
            updatedAt: Date.now()
        });
        window.showToast("Pack restored.");
        window.closePackDetails();
        if (window.openPacksModal) window.openPacksModal();
    } catch (e) {
        console.error(e);
        window.showToast("Failed to unarchive pack.");
    }
};

window.executeAdminDelete = async () => {
    if (!window.pendingAdminDelete) return;
    const { type, id, name, targetUserId, isPrivate } = window.pendingAdminDelete;
    const reason = document.getElementById('admin-del-reason').value.trim();
    
    document.getElementById('admin-delete-prompt-modal').classList.add('hidden');
    window.showToast("Executing Admin Override...");

    try {
        if (reason && targetUserId) {
            await updateDoc(doc(db, 'users', targetUserId), {
                notifications: arrayUnion({
                    type: type === 'campaign' ? 'Realm Deleted' : 'Pack Deleted',
                    itemName: name,
                    message: reason,
                    timestamp: Date.now()
                })
            });
        }

        if (type === 'campaign') {
            await deleteDoc(doc(db, 'campaigns', id));
            window.showToast("Realm destroyed.");
        } else if (type === 'pack') {
            const pathArgs = isPrivate 
                ? ['artifacts', 'global_codex', 'users', targetUserId, 'scriptPacks', id]
                : ['artifacts', 'global_codex', 'public', 'data', 'scriptPacks', id];
            await deleteDoc(doc(db, ...pathArgs));
            window.showToast("Pack permanently obliterated.");
            window.closePackDetails();
        }
    } catch (err) {
        console.error(err);
        window.showToast("Admin action failed.");
    }
    window.pendingAdminDelete = null;
};

window.dismissNotifications = async () => {
    if (!currentUser) return;
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), { notifications: [] });
        document.getElementById('user-notifications-modal').classList.add('hidden');
    } catch(e) {
        window.showToast("Failed to dismiss notifications.");
    }
};

window.joinByCode = async () => {
    if (currentUser?.isBanned) return window.showToast("You are banished. Action denied.");
    const code = document.getElementById('invite-code-input').value.trim().toUpperCase();
    if (!code) return window.showToast("Enter a code first.");

    try {
        const q = query(collection(db, 'campaigns'), where('inviteCode', '==', code));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            window.showToast("Invalid Invite Code.");
            return;
        }

        const camp = snap.docs[0];

        if (currentUser && currentUser.uid) {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                joinedCampaigns: arrayUnion(camp.id)
            });
        }

        window.showToast(`Joined ${camp.data().name}!`);
        
        setTimeout(() => {
            try { window.location.href = `characters.html?id=${camp.id}`; } 
            catch(e) { window.showToast("Redirect disabled in preview."); }
        }, 1000);

    } catch (err) {
        console.error(err);
        window.showToast("Error joining campaign.");
    }
};

window.joinPublicCampaign = async (id, name) => {
    if (currentUser?.isBanned) return window.showToast("You are banished. Action denied.");
    if (!currentUser || currentUser.role !== 'player') return;
    try {
        const camp = allCampaigns.find(c => c.id === id);
        if (camp && camp.visibility === 'public' && camp.maxPlayers) {
            const q = query(collection(db, 'users'), where('joinedCampaigns', 'array-contains', id));
            const snap = await getDocs(q);
            if (snap.size >= camp.maxPlayers) {
                return window.showToast("This public realm has reached its player limit.");
            }
        }

        await updateDoc(doc(db, 'users', currentUser.uid), {
            joinedCampaigns: arrayUnion(id)
        });
        window.showToast(`Joined the realm of ${name}!`);
        if (document.getElementById('pack-details-modal').classList.contains('hidden') === false) {
            window.closePackDetails(); 
        }
    } catch(e) {
        console.error(e);
        window.showToast("Failed to join realm.");
    }
};

window.createCampaign = async () => {
    if (currentUser?.isBanned) return window.showToast("You are banished. Action denied.");
    if (!currentUser || currentUser.role !== 'dm') return;
    const name = document.getElementById('new-campaign-name').value.trim();
    const desc = document.getElementById('new-campaign-desc').value.trim();
    const vis = document.getElementById('new-campaign-vis').value;
    const packId = document.getElementById('new-campaign-pack').value;
    
    if (!name) return window.showToast("Name is required.");

    window.showToast("Forging Realm...");

    try {
        let packName = "Blank Slate";
        let selectedPack = null;
        if (packId) {
            selectedPack = availablePacks.find(p => p.id === packId);
            if (selectedPack) packName = selectedPack.name;
        }

        let maxPlayers = null;
        if (vis === 'public') {
            const limitVal = document.getElementById('new-campaign-limit').value;
            if (limitVal && !isNaN(limitVal)) {
                maxPlayers = parseInt(limitVal);
            }
        }

        const newRef = await addDoc(collection(db, 'campaigns'), {
            name: name,
            description: desc,
            visibility: vis,
            maxPlayers: maxPlayers,
            dmId: currentUser.uid,
            dmName: currentUser.username,
            inviteCode: generateCode(),
            packName: packName,
            createdAt: Date.now()
        });

        if (selectedPack) {
            const pathArgs = selectedPack.isPrivate 
                ? ['artifacts', 'global_codex', 'users', selectedPack.authorId, 'scriptPacks', selectedPack.id]
                : ['artifacts', 'global_codex', 'public', 'data', 'scriptPacks', selectedPack.id];
            
            const currentDownloads = selectedPack.downloads || 0;
            await updateDoc(doc(db, ...pathArgs), { downloads: currentDownloads + 1 });

            if (selectedPack.scripts && selectedPack.scripts.length > 0) {
                const batch = writeBatch(db);
                const codexRef = collection(db, 'artifacts', newRef.id, 'public', 'data', `scriptCodex_${newRef.id}`);
                selectedPack.scripts.forEach(script => {
                    const docRef = doc(codexRef);
                    batch.set(docRef, { ...script, createdAt: Date.now(), updatedAt: Date.now() });
                });
                await batch.commit();
            }
        }

        await updateDoc(doc(db, 'users', currentUser.uid), {
            joinedCampaigns: arrayUnion(newRef.id)
        });

        document.getElementById('create-campaign-modal').classList.add('hidden');
        document.getElementById('new-campaign-name').value = '';
        document.getElementById('new-campaign-desc').value = '';
        document.getElementById('new-campaign-pack').value = '';
        document.getElementById('new-campaign-limit').value = '';
        document.getElementById('new-campaign-vis').value = 'private';
        document.getElementById('new-campaign-limit-container').classList.add('hidden');
        document.getElementById('new-campaign-pack-preview').classList.add('hidden');
        window.showToast("Realm Forged Successfully!");

    } catch (err) {
        console.error(err);
        window.showToast("Failed to forge realm.");
    }
};

window.openEditCampaign = (id) => {
    const camp = allCampaigns.find(c => c.id === id);
    if (!camp) return;

    document.getElementById('edit-campaign-id').value = camp.id;
    document.getElementById('edit-campaign-name').value = camp.name || '';
    document.getElementById('edit-campaign-desc').value = camp.description || '';
    document.getElementById('edit-campaign-vis').value = camp.visibility || 'private';
    document.getElementById('edit-campaign-code').value = camp.inviteCode || '';
    
    document.getElementById('edit-campaign-limit-container').classList.toggle('hidden', camp.visibility !== 'public');
    document.getElementById('edit-campaign-limit').value = camp.maxPlayers || '';
    
    const editPackSelect = document.getElementById('edit-campaign-pack');
    if (editPackSelect) {
        editPackSelect.value = '';
        document.getElementById('edit-campaign-pack-preview').classList.add('hidden');
    }

    document.getElementById('edit-campaign-modal').classList.remove('hidden');
};

window.saveCampaignEdit = async () => {
    const id = document.getElementById('edit-campaign-id').value;
    const name = document.getElementById('edit-campaign-name').value.trim();
    const desc = document.getElementById('edit-campaign-desc').value.trim();
    const vis = document.getElementById('edit-campaign-vis').value;
    const code = document.getElementById('edit-campaign-code').value.trim().toUpperCase();
    const packId = document.getElementById('edit-campaign-pack').value;

    if (!name) return window.showToast("Name is required.");
    if (!code) return window.showToast("Invite code is required.");

    try {
        let maxPlayers = null;
        if (vis === 'public') {
            const limitVal = document.getElementById('edit-campaign-limit').value;
            if (limitVal && !isNaN(limitVal)) {
                maxPlayers = parseInt(limitVal);
            }
        }

        const updates = {
            name: name,
            description: desc,
            visibility: vis,
            maxPlayers: maxPlayers,
            inviteCode: code
        };

        let selectedPack = null;
        if (packId) {
            selectedPack = availablePacks.find(p => p.id === packId);
            if (selectedPack) {
                updates.packName = selectedPack.name; 
                
                const pathArgs = selectedPack.isPrivate 
                    ? ['artifacts', 'global_codex', 'users', selectedPack.authorId, 'scriptPacks', selectedPack.id]
                    : ['artifacts', 'global_codex', 'public', 'data', 'scriptPacks', selectedPack.id];
                
                const currentDownloads = selectedPack.downloads || 0;
                await updateDoc(doc(db, ...pathArgs), { downloads: currentDownloads + 1 });
                
                if (selectedPack.scripts && selectedPack.scripts.length > 0) {
                    window.showToast("Injecting scripts...");
                    const batch = writeBatch(db);
                    const codexRef = collection(db, 'artifacts', id, 'public', 'data', `scriptCodex_${id}`);
                    selectedPack.scripts.forEach(script => {
                        const docRef = doc(codexRef);
                        batch.set(docRef, { ...script, createdAt: Date.now(), updatedAt: Date.now() });
                    });
                    await batch.commit();
                }
            }
        }

        await updateDoc(doc(db, 'campaigns', id), updates);
        document.getElementById('edit-campaign-modal').classList.add('hidden');
        window.showToast("Realm Updated!");
    } catch (err) {
        console.error(err);
        window.showToast("Failed to update realm.");
    }
};

window.deleteCampaign = async (id, name, dmId) => {
    if (adminModeActive && dmId !== currentUser.uid) {
        window.pendingAdminDelete = { type: 'campaign', id, name, targetUserId: dmId };
        document.getElementById('admin-del-title').innerText = `Delete Realm: ${name}`;
        document.getElementById('admin-del-reason').value = '';
        document.getElementById('admin-delete-prompt-modal').classList.remove('hidden');
        return;
    }

    if (!confirm(`Are you sure you want to permanently destroy the realm of "${name}"? This cannot be undone.`)) return;
    
    try {
        await deleteDoc(doc(db, 'campaigns', id));
        window.showToast("Realm destroyed.");
    } catch (err) {
        console.error(err);
        window.showToast("Failed to destroy realm.");
    }
};

window.leaveCampaign = async (id, name) => {
    if (!confirm(`Are you sure you want to leave the realm of "${name}"? You will need the invite code to return.`)) return;
    
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            joinedCampaigns: arrayRemove(id)
        });
        window.showToast("You have left the realm.");
    } catch (err) {
        console.error(err);
        window.showToast("Failed to leave realm.");
    }
};

window.logout = () => {
    signOut(auth).then(() => {
        try { window.location.href = "index.html"; } catch(e) {}
    });
};

onAuthStateChanged(auth, async (u) => {
    if (!u) {
        try { window.location.href = "index.html"; } catch(e) {
            document.getElementById('initial-loading').innerHTML = `<h2 class="font-heading text-2xl text-blood">Authentication Required</h2>`;
        }
        return;
    }
    
    try {
        const userDocRef = doc(db, 'users', u.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            currentUser = { uid: u.uid, ...userDocSnap.data() };
        } else {
            currentUser = { 
                uid: u.uid, 
                username: u.displayName || '', 
                role: 'player',
                joinedCampaigns: [],
                blockedUsers: []
            };
            await setDoc(userDocRef, currentUser);
        }

        if (!currentUser.joinedCampaigns) currentUser.joinedCampaigns = [];
        if (!currentUser.blockedUsers) currentUser.blockedUsers = [];

        if (!currentUser.username || currentUser.username.trim() === '' || !currentUser.ageCategory) {
            window.openUsernameModal();
        }

        let display = currentUser.username;
        if (!display && u.email) {
            display = u.email.split('@')[0]; 
        } else if (!display) {
            display = 'Traveler';
        }
        document.getElementById('user-display-name').innerText = display;

        const roleBadge = document.getElementById('user-role-badge');
        const createBtn = document.getElementById('btn-create-campaign');
        const playerActions = document.getElementById('player-actions');
        const adminBtn = document.getElementById('btn-admin-terminal');

        if (u.email === ADMIN_OWNER_EMAIL) {
            adminBtn.classList.remove('hidden');
            playerActions.classList.remove('hidden'); 
            const reportTab = document.getElementById('chat-tab-reports');
            if(reportTab) reportTab.classList.remove('hidden');
            window.initAdminReports();
        }

        document.getElementById('chat-toggle-btn').classList.remove('hidden');
        window.initGlobalChat();
        window.initDirectMessaging();
        window.initFriendsSync();

        if (currentUser.role === 'dm') {
            roleBadge.innerText = 'DM';
            roleBadge.className = 'bg-blood text-white px-2 py-0.5 rounded text-[10px] uppercase tracking-widest font-heading font-black shadow-md';
            createBtn.classList.remove('hidden');
            
            if (u.email !== ADMIN_OWNER_EMAIL) {
                playerActions.classList.add('hidden'); 
            }
            
            try {
                const pubSnap = await getDocs(collection(db, 'artifacts', 'global_codex', 'public', 'data', 'scriptPacks'));
                const privSnap = await getDocs(collection(db, 'artifacts', 'global_codex', 'users', currentUser.uid, 'scriptPacks'));
                availablePacks = [
                    ...pubSnap.docs.map(d => ({id: d.id, isPrivate: false, ...d.data()})),
                    ...privSnap.docs.map(d => ({id: d.id, isPrivate: true, ...d.data()}))
                ];
                
                const populatePackSelect = (selectId, previewId, defaultText) => {
                    const packSelect = document.getElementById(selectId);
                    if (packSelect) {
                        packSelect.innerHTML = `<option value="">${defaultText}</option>`;
                        availablePacks.forEach(p => {
                            const visLabel = p.isPrivate ? '(Private)' : '(Public)';
                            const arcLabel = p.isDeleted ? '[Archived]' : '';
                            packSelect.innerHTML += `<option value="${p.id}">${p.name} ${visLabel} ${arcLabel}</option>`;
                        });
                        
                        const packPreview = document.getElementById(previewId);
                        packSelect.addEventListener('change', (e) => {
                            const pid = e.target.value;
                            const p = availablePacks.find(x => x.id === pid);
                            if (p) {
                                const arcWarning = p.isDeleted ? `<div class="text-red-600 font-bold mb-2 font-heading uppercase tracking-widest text-[10px]"><i class="fa-solid fa-box-archive mr-1"></i> Archived - No Longer Updating</div>` : '';
                                packPreview.innerHTML = `${arcWarning}<b class="font-heading font-black text-blood not-italic uppercase text-[10px] tracking-widest block mb-1">Version ${p.version || 1}</b><span class="font-bold text-gray-800">Latest Update:</span> ${p.updateNotes || 'Initial publication.'}<br><br><span class="text-gray-600">${p.description || 'No description provided.'}</span>`;
                                packPreview.classList.remove('hidden');
                            } else {
                                packPreview.classList.add('hidden');
                            }
                        });
                    }
                };

                populatePackSelect('new-campaign-pack', 'new-campaign-pack-preview', 'Blank Slate (No Scripts)');
                populatePackSelect('edit-campaign-pack', 'edit-campaign-pack-preview', 'No Additional Pack');
                
            } catch(err) {
                console.error("Error fetching packs:", err);
            }

        } else {
            roleBadge.innerText = 'PLAYER';
            roleBadge.className = 'bg-gray-600 text-white px-2 py-0.5 rounded text-[10px] uppercase tracking-widest font-heading font-black shadow-md';
            createBtn.classList.add('hidden');
            playerActions.classList.remove('hidden');
        }
        
        try {
            const pubSnap = await getDocs(collection(db, 'artifacts', 'global_codex', 'public', 'data', 'scriptPacks'));
            let privSnap = { docs: [] };
            if (currentUser.role === 'dm') {
                privSnap = await getDocs(collection(db, 'artifacts', 'global_codex', 'users', currentUser.uid, 'scriptPacks'));
            }
            
            allFetchedPacks = [
                ...pubSnap.docs.map(d => ({id: d.id, isPrivate: false, ...d.data()})),
                ...privSnap.docs.map(d => ({id: d.id, isPrivate: true, ...d.data()}))
            ];
        } catch(err) {
            console.error("Error fetching generic packs:", err);
        }

        document.getElementById('initial-loading').classList.add('hidden');
        document.getElementById('dashboard-screen').classList.remove('hidden');

        onSnapshot(collection(db, 'campaigns'), (snap) => {
            allCampaigns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            renderCampaigns();
        });

        onSnapshot(userDocRef, (userSnap) => {
            if (userSnap.exists()) {
                currentUser = { uid: u.uid, ...userSnap.data() };
                if (!currentUser.joinedCampaigns) currentUser.joinedCampaigns = [];
                if (!currentUser.blockedUsers) currentUser.blockedUsers = [];
                
                let updatedDisplay = currentUser.username || (u.email ? u.email.split('@')[0] : 'Traveler');
                document.getElementById('user-display-name').innerText = updatedDisplay;
                
                if (currentUser.ageCategory === 'under_17') {
                    const allianceBtn = document.getElementById('btn-form-alliance');
                    if(allianceBtn) allianceBtn.classList.add('hidden');
                }

                const banBanner = document.getElementById('banned-banner');
                if (currentUser.isBanned) {
                    if (banBanner) banBanner.classList.remove('hidden');
                } else {
                    if (banBanner) banBanner.classList.add('hidden');
                }
                
                const muteBanner = document.getElementById('muted-banner');
                if (currentUser.mutedUntil && currentUser.mutedUntil > Date.now()) {
                    if (muteBanner) muteBanner.classList.remove('hidden');
                } else {
                    if (muteBanner) muteBanner.classList.add('hidden');
                }

                if (currentUser.notifications && currentUser.notifications.length > 0) {
                    const notifContainer = document.getElementById('notifications-list');
                    notifContainer.innerHTML = currentUser.notifications.map(n => `
                        <div class="bg-parchment border-2 border-blood/50 p-4 rounded mb-3 shadow-inner">
                            <h4 class="font-heading font-black text-blood text-sm uppercase tracking-widest">${n.type}: ${n.itemName}</h4>
                            <p class="text-[10px] text-gray-500 font-serif mb-2 italic border-b border-gray-300 pb-1">${new Date(n.timestamp).toLocaleString()}</p>
                            <p class="text-sm font-serif text-ink mt-2">" ${n.message} "</p>
                        </div>
                    `).join('');
                    document.getElementById('user-notifications-modal').classList.remove('hidden');
                }

                renderCampaigns();
                if(window.renderGlobalChat) window.renderGlobalChat(); 
            }
        });

    } catch (error) {
        console.error(error);
        document.getElementById('initial-loading').innerHTML = `
            <div class="parchment-bg p-8 rounded border border-blood max-w-md text-center">
                <h2 class="font-heading text-xl text-blood font-bold mb-4">Connection Failed</h2>
                <p class="text-sm text-ink mb-4">${error.message}</p>
                <p class="text-xs text-gray-600 font-bold">If on GitHub Pages, ensure <span class="text-blood text-[14px]">your-username.github.io</span> is added to Firebase Console -> Authentication -> Settings -> Authorized Domains.</p>
            </div>
        `;
    }
});