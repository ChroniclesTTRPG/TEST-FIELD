import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCKRN5dfi4og69_D8ZAvV1BQfwCK_f2uis",
    authDomain: "dndcampaigns-f3d48.firebaseapp.com",
    projectId: "dndcampaigns-f3d48",
    storageBucket: "dndcampaigns-f3d48.firebasestorage.app",
    messagingSenderId: "1074491536795",
    appId: "1:1074491536795:web:56211729489be776d79d3e",
    measurementId: "G-71DW54NTWV"
};

const app = initializeApp(firebaseConfig);

let analytics;
try {
    analytics = getAnalytics(app);
} catch(e) {
    console.log("Analytics blocked by client.");
}

const auth = getAuth(app);
const db = getFirestore(app);

window.logoutAuth = () => {
    signOut(auth).then(() => window.location.reload());
};

window.isAuthenticating = false;

// Direct root-relative path prevents /home/home/ duplication
window.proceedToCampaigns = async (user) => {
    const targetUrl = "/TEST-FIELD/nexus/campaigns.html";
    try {
        window.location.href = targetUrl;
    } catch(e) {
        let display = user.displayName || "Traveler";
        try {
            const snap = await getDoc(doc(db, 'users', user.uid));
            if(snap.exists() && snap.data().username) display = snap.data().username;
        } catch(err) {}

        document.getElementById('initial-loading').classList.add('hidden');
        document.getElementById('auth-view').innerHTML = `
            <div class="parchment-bg p-10 text-center shadow-2xl border-2 border-gold rounded-lg max-w-sm">
                <h2 class="text-blood font-heading text-2xl mb-4 font-bold">Welcome Back, ${display}!</h2>
                <p class="text-ink font-serif text-sm">Automatic redirect was prevented.<br><br><a href="${targetUrl}" class="text-blood font-bold underline">Click here to enter the Nexus</a>.</p>
                <button onclick="window.logoutAuth()" class="mt-6 text-xs text-blood font-bold uppercase tracking-widest hover:underline font-heading">Switch Account / Log Out</button>
            </div>
        `;
        document.getElementById('auth-view').classList.remove('hidden');
        document.getElementById('auth-view').classList.add('fade-in');
    }
};

// --- AUTHENTICATION STATE OBSERVER ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (window.isAuthenticating) return;
        await window.proceedToCampaigns(user);
    } else {
        document.getElementById('initial-loading').classList.add('hidden');
        document.getElementById('intro-view').classList.remove('hidden');
        document.getElementById('intro-view').classList.add('fade-in');
    }
});

// Handle DM Secret visibility
document.querySelectorAll('input[name="auth-role"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        document.getElementById('dm-secret-container').classList.toggle('hidden', e.target.value !== 'dm');
    });
});

// Handle Guest Sign-In
document.getElementById('btn-guest-signin').addEventListener('click', async () => {
    const submitBtn = document.getElementById('btn-guest-signin');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = "<i class='fa-solid fa-spinner fa-spin mr-2'></i>Opening Gates...";
    submitBtn.disabled = true;
    window.isAuthenticating = true;

    try {
        const cred = await signInAnonymously(auth);
        await window.proceedToCampaigns(cred.user);
    } catch (error) {
        console.error("Guest Auth Error:", error);
        window.showModal("Error", "Failed to enter as guest. " + error.message);
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        window.isAuthenticating = false;
    }
});

// Handle Login/Register Submission
document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    
    if(!email || !password) return window.showModal("Hold!", "Email and password are required.");
    
    const submitBtn = document.getElementById('auth-submit-btn');
    submitBtn.innerText = "Entering the Realm...";
    submitBtn.disabled = true;
    window.isAuthenticating = true;

    try {
        let user;
        if (window.currentAuthMode === 'register') {
            const role = document.querySelector('input[name="auth-role"]:checked').value;
            const dmSecret = document.getElementById('auth-dm-secret').value.trim();
            
            if (role === 'dm' && !dmSecret) {
                submitBtn.innerText = "Forge Account";
                submitBtn.disabled = false;
                window.isAuthenticating = false;
                return window.showModal("Hold!", "A Dungeon Master must set a Sanctum password.");
            }

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            user = userCredential.user;

            await setDoc(doc(db, 'users', user.uid), {
                username: '',
                email: email,
                role: role,
                dmSecret: role === 'dm' ? dmSecret : null,
                createdAt: new Date().toISOString()
            });
        } else {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            user = userCredential.user;
        }
        
        await window.proceedToCampaigns(user);
        
    } catch (error) {
        console.error("Auth Error:", error);
        window.isAuthenticating = false;
        submitBtn.disabled = false;
        submitBtn.innerText = window.currentAuthMode === 'login' ? "Enter the Realm" : "Forge Account";
        
        if(error.code === 'auth/email-already-in-use') {
            window.showModal("Access Denied", "That email is already claimed by another traveler.");
        } else if (error.code === 'auth/invalid-credential') {
            window.showModal("Access Denied", "Incorrect email or passphrase.");
        } else {
            window.showModal("Error", error.message);
        }
    }
});
