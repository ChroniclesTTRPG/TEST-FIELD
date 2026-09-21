// Global State variables
window.currentAuthMode = 'login';

window.enterGame = function() {
    const introView = document.getElementById('intro-view');
    const authView = document.getElementById('auth-view');

    // Initiate the visual screen transition
    introView.classList.remove('fade-in');
    introView.classList.add('fade-out');

    setTimeout(() => {
        introView.classList.add('hidden');
        authView.classList.remove('hidden');
        authView.classList.add('slide-up');
    }, 600);
};

window.switchAuthTab = function(mode) {
    window.currentAuthMode = mode;
    
    const btnLogin = document.getElementById('tab-login');
    const btnRegister = document.getElementById('tab-register');
    const registerFields = document.getElementById('register-fields');
    const submitBtn = document.getElementById('auth-submit-btn');

    if (mode === 'login') {
        btnLogin.className = "flex-1 py-2 font-heading font-bold text-blood border-b-4 border-blood";
        btnRegister.className = "flex-1 py-2 font-heading font-bold text-ink hover:text-blood transition";
        registerFields.classList.add('hidden');
        submitBtn.innerText = "Enter the Realm";
    } else {
        btnRegister.className = "flex-1 py-2 font-heading font-bold text-blood border-b-4 border-blood";
        btnLogin.className = "flex-1 py-2 font-heading font-bold text-ink hover:text-blood transition";
        registerFields.classList.remove('hidden');
        submitBtn.innerText = "Forge Account";
        
        registerFields.classList.add('slide-up');
        setTimeout(() => registerFields.classList.remove('slide-up'), 600);
    }
};

window.showModal = function(title, message) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-message').innerText = message;
    document.getElementById('modal-container').classList.remove('hidden');
};
