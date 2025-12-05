import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
    getAuth,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    sendPasswordResetEmail,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Firebase configuration (provided)
const firebaseConfig = {
    apiKey: "AIzaSyCPmnm713iyGIW9aUEZMZDFyrfVTsadXIE",
    authDomain: "trainingsocialacount.firebaseapp.com",
    projectId: "trainingsocialacount",
    storageBucket: "trainingsocialacount.firebasestorage.app",
    messagingSenderId: "421668100128",
    appId: "1:421668100128:web:1dcdbc1bc6e10001904445",
    measurementId: "G-9J8Z8VTTLZ"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// DOM Elements
const authContainer = document.getElementById('authContainer');
const dashboardContainer = document.getElementById('dashboardContainer');
const pages = {
    login: document.getElementById('loginPage'),
    signup: document.getElementById('signupPage'),
    profile: document.getElementById('profilePage')
};
const tabAdmin = document.getElementById('tabAdmin');
const tabParticipants = document.getElementById('tabParticipants');
const adminView = document.getElementById('adminView');
const participantView = document.getElementById('participantView');
const loginFormElement = document.getElementById('loginFormElement');
const signupFormElement = document.getElementById('signupFormElement');
const showSignupBtn = document.getElementById('showSignup');
const showLoginBtn = document.getElementById('showLogin');
const forgotPasswordLink = document.querySelector('.forgot-password');
const googleLoginBtn = document.getElementById('googleLogin');
const logoutBtn = document.getElementById('logoutBtn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const birthDateInput = document.getElementById('signupBirthDate');
const ageInput = document.getElementById('signupAge');
const conditionInput = document.getElementById('signupConditionInput');
const addConditionBtn = document.getElementById('addConditionBtn');
const conditionChips = document.getElementById('conditionChips');
const editProfileBtn = document.getElementById('editProfileBtn');
const editProfileModal = document.getElementById('editProfileModal');
const closeEditModalBtn = document.getElementById('closeEditModal');
const cancelEditBtn = document.getElementById('cancelEdit');
const editProfileForm = document.getElementById('editProfileForm');
const editStatus = document.getElementById('editStatus');
const editRegion = document.getElementById('editRegion');
const editNotes = document.getElementById('editNotes');
const editConditionInput = document.getElementById('editConditionInput');
const editAddConditionBtn = document.getElementById('editAddConditionBtn');
const editConditionChips = document.getElementById('editConditionChips');
const participantCountEl = document.getElementById('participantCount');
const participantTableBody = document.getElementById('participantTableBody');
const addParticipantBtn = document.getElementById('addParticipantBtn');
const participantModal = document.getElementById('participantModal');
const participantModalTitle = document.getElementById('participantModalTitle');
const closeParticipantModalBtn = document.getElementById('closeParticipantModal');
const cancelParticipantBtn = document.getElementById('cancelParticipant');
const participantForm = document.getElementById('participantForm');
const participantNameInput = document.getElementById('participantName');
const participantEmailInput = document.getElementById('participantEmail');
const participantBirthDateInput = document.getElementById('participantBirthDate');
const participantAgeInput = document.getElementById('participantAge');
const participantGenderInput = document.getElementById('participantGender');
const participantRegionInput = document.getElementById('participantRegion');
const participantStatusInput = document.getElementById('participantStatus');
const participantLastSeenInput = document.getElementById('participantLastSeen');
const participantNotesInput = document.getElementById('participantNotes');
const participantConditionInput = document.getElementById('participantConditionInput');
const participantAddConditionBtn = document.getElementById('participantAddConditionBtn');
const participantConditionChips = document.getElementById('participantConditionChips');

// Current user state
let currentUser = null;
let conditionList = [];
let editConditionList = [];
let participantConditionList = [];
let participants = [];
let editingParticipantId = null;

// Initialize app
window.addEventListener('DOMContentLoaded', () => {
    handleGoogleRedirectResult();
    checkLoginState();
    setupEventListeners();
    renderConditionChips();
    renderParticipantConditionChips();
});

// Setup event listeners
function setupEventListeners() {
    // Form switching
    showSignupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        switchToSignup();
    });

    showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        switchToLogin();
    });

    // Form submissions
    loginFormElement.addEventListener('submit', handleLogin);
    signupFormElement.addEventListener('submit', handleSignup);

    // Password reset
    forgotPasswordLink?.addEventListener('click', handlePasswordReset);

    // Google login
    googleLoginBtn?.addEventListener('click', handleGoogleLogin);

    // Logout
    logoutBtn.addEventListener('click', handleLogout);

    // Derived fields
    birthDateInput.addEventListener('change', updateAgeFromBirthdate);

    // Condition chips
    addConditionBtn.addEventListener('click', addConditionFromInput);
    conditionInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addConditionFromInput();
        }
    });

    signupFormElement.addEventListener('reset', () => {
        conditionList = [];
        renderConditionChips();
        ageInput.value = '';
    });

    // Dashboard tabs
    tabAdmin?.addEventListener('click', () => setDashboardTab('admin'));
    tabParticipants?.addEventListener('click', () => setDashboardTab('participants'));

    // Profile edit modal
    editProfileBtn?.addEventListener('click', openEditModal);
    closeEditModalBtn?.addEventListener('click', closeEditModal);
    cancelEditBtn?.addEventListener('click', closeEditModal);
    editProfileForm?.addEventListener('submit', handleProfileUpdate);

    editAddConditionBtn?.addEventListener('click', addEditConditionFromInput);
    editConditionInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addEditConditionFromInput();
        }
    });

    // Participants modal
    addParticipantBtn?.addEventListener('click', () => openParticipantModal('add'));
    closeParticipantModalBtn?.addEventListener('click', closeParticipantModal);
    cancelParticipantBtn?.addEventListener('click', closeParticipantModal);
    participantForm?.addEventListener('submit', handleParticipantSubmit);
    participantBirthDateInput?.addEventListener('change', updateParticipantAgeFromBirthdate);
    participantAddConditionBtn?.addEventListener('click', addParticipantConditionFromInput);
    participantConditionInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addParticipantConditionFromInput();
        }
    });
}

// Switch between forms
function switchToSignup() {
    setActivePage('signup');
}

function switchToLogin() {
    setActivePage('login');
}

// Check if user is already logged in
function checkLoginState() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                await loadUserProfile(user);
                await loadParticipants();
            } catch (error) {
                console.error('Profile load error (onAuthStateChanged):', error);
                currentUser = buildFallbackProfile(user);
                showToast(getFirestoreErrorMessage(error), 'warning');
            }

            showDashboard();
        } else {
            currentUser = null;
            showAuth();
        }
    });
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;

    if (!email || !password) {
        showToast('모든 필드를 입력해주세요.', 'error');
        return;
    }

    try {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        const credential = await signInWithEmailAndPassword(auth, email, password);
        await finalizeLoginFlow(credential.user, '로그인 성공!');
    } catch (error) {
        console.error('Login error:', error);
        showToast(getAuthErrorMessage(error), 'error');
    }
}

// Handle signup
async function handleSignup(e) {
    e.preventDefault();

    const fullName = document.getElementById('signupFullName').value.trim();
    const username = document.getElementById('signupUsername').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const birthDate = birthDateInput.value;
    const age = calculateAgeFromBirthDate(birthDate);
    ageInput.value = Number.isFinite(age) ? age : '';
    const gender = document.getElementById('signupGender').value;
    const region = document.getElementById('signupRegion').value.trim();
    const conditions = [...conditionList];
    const status = document.getElementById('signupStatus').value;
    const notes = document.getElementById('signupNotes').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;

    // Validation
    if (!fullName || !username || !email || !birthDate || !gender || !region || !status || !password || !confirmPassword) {
        showToast('모든 필드를 입력해주세요.', 'error');
        return;
    }

    if (!conditions.length) {
        showToast('질환명을 하나 이상 입력해주세요.', 'error');
        return;
    }

    if (!Number.isFinite(age) || age < 0) {
        showToast('생년월일을 올바르게 입력해주세요.', 'error');
        return;
    }

    if (!agreeTerms) {
        showToast('이용약관에 동의해주세요.', 'warning');
        return;
    }

    if (password !== confirmPassword) {
        showToast('비밀번호가 일치하지 않습니다.', 'error');
        return;
    }

    if (!isStrongPassword(password)) {
        showToast('비밀번호는 8자 이상, 대문자/소문자/숫자/특수문자를 포함해야 합니다.', 'error');
        return;
    }

    if (!isValidEmail(email)) {
        showToast('올바른 이메일 주소를 입력해주세요.', 'error');
        return;
    }

    try {
        const usernameAvailable = await checkUsernameAvailability(username);
        if (usernameAvailable === false) {
            showToast('이미 사용 중인 사용자명입니다.', 'error');
            return;
        }

        // Create new user via Firebase Auth
        const credential = await createUserWithEmailAndPassword(auth, email, password);

        // Save profile to Firestore if 권한이 허용될 때만 시도
        const userProfile = {
            username,
            fullName,
            email,
            birthDate,
            age: Number(age),
            gender,
            region,
            conditions,
            status,
            notes,
            createdAt: serverTimestamp()
        };

        await Promise.all([
            updateProfile(credential.user, { displayName: fullName }).catch(() => {}),
            saveProfileIfAllowed(credential.user.uid, userProfile)
        ]);

        await finalizeLoginFlow(credential.user, '회원가입 성공! 대시보드로 이동합니다.');
    } catch (error) {
        console.error('Signup error:', error);
        showToast(getAuthErrorMessage(error), 'error');
    }
}

// Handle Google login
async function handleGoogleLogin(e) {
    e.preventDefault();

    const rememberMe = document.getElementById('rememberMe').checked;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        const credential = await signInWithPopup(auth, provider);
        await finalizeLoginFlow(credential.user, 'Google 계정으로 로그인되었습니다.');
    } catch (error) {
        console.error('Google login error:', error);
        if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/operation-not-supported-in-this-environment') {
            await signInWithRedirect(auth, provider);
            return;
        }

        showToast(getAuthErrorMessage(error), 'error');
    }
}

// Handle redirect-based Google login (e.g., popup blocked environments)
async function handleGoogleRedirectResult() {
    try {
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult?.user) {
            await finalizeLoginFlow(redirectResult.user, 'Google 계정으로 로그인되었습니다.');
        }
    } catch (error) {
        console.error('Google redirect error:', error);
        showToast(getAuthErrorMessage(error), 'error');
    }
}

// Handle password reset
async function handlePasswordReset(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    if (!email) {
        showToast('비밀번호를 재설정할 이메일을 입력해주세요.', 'warning');
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        showToast('비밀번호 재설정 메일을 전송했습니다.', 'success');
    } catch (error) {
        console.error('Password reset error:', error);
        showToast(getAuthErrorMessage(error), 'error');
    }
}

// Handle logout
async function handleLogout() {
    try {
        await signOut(auth);
        currentUser = null;
        participants = [];
        participantConditionList = [];
        showToast('로그아웃되었습니다.', 'success');
        setTimeout(() => {
            showAuth();
            loginFormElement.reset();
            signupFormElement.reset();
        }, 500);
    } catch (error) {
        console.error('Logout error:', error);
        showToast('로그아웃 중 오류가 발생했습니다.', 'error');
    }
}

// Load user profile from Firestore
async function loadUserProfile(user) {
    try {
        const profileRef = doc(db, 'users', user.uid);
        const profileSnap = await getDoc(profileRef);

        if (profileSnap.exists()) {
            const data = profileSnap.data();
            currentUser = {
                uid: user.uid,
                email: user.email,
                fullName: data.fullName || user.displayName || '사용자',
                username: data.username || user.email?.split('@')[0] || 'user',
                birthDate: data.birthDate,
                age: data.age,
                gender: data.gender,
                region: data.region,
                conditions: normalizeConditions(data.conditions ?? data.condition),
                status: data.status || 'active',
                notes: data.notes,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt
            };
            return;
        }

        // Firestore 접근 권한이 없는 경우를 대비해 프로필 생성을 선택적으로 처리
        currentUser = buildFallbackProfile(user);
        await saveProfileIfAllowed(user.uid, {
            fullName: currentUser.fullName,
            username: currentUser.username,
            email: currentUser.email,
            birthDate: currentUser.birthDate,
            age: currentUser.age,
            gender: currentUser.gender,
            region: currentUser.region,
            conditions: currentUser.conditions,
            status: currentUser.status,
            notes: currentUser.notes,
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Profile load error:', error);
        currentUser = buildFallbackProfile(user);
        if (!isFirestorePermissionError(error)) {
            throw error;
        }
    }
}

// Load participants assigned to current admin
async function loadParticipants() {
    if (!currentUser) return;
    try {
        const participantsQuery = query(collection(db, 'participants'), where('adminId', '==', currentUser.uid));
        const snapshot = await getDocs(participantsQuery);
        participants = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
                lastSeen: data.lastSeen?.toDate ? data.lastSeen.toDate() : data.lastSeen
            };
        });
    } catch (error) {
        if (!isFirestorePermissionError(error)) {
            console.error('Participants load error:', error);
            showToast(getFirestoreErrorMessage(error), 'error');
        }
    }

    updateDashboard(currentUser);
}

// Show dashboard
function showDashboard() {
    if (!currentUser) return;

    authContainer.classList.add('hidden');
    dashboardContainer.classList.remove('hidden');
    setActivePage('profile');
    setDashboardTab('admin');
    updateDashboard(currentUser);
}

// Shared post-auth flow
async function finalizeLoginFlow(user, message) {
    try {
        await loadUserProfile(user);
        await loadParticipants();
    } catch (error) {
        showToast(getFirestoreErrorMessage(error), 'warning');
    }

    showToast(message, 'success');
    showDashboard();
}

// Show auth forms
function showAuth() {
    dashboardContainer.classList.add('hidden');
    authContainer.classList.remove('hidden');
    setActivePage('login');
}

function setActivePage(pageKey) {
    Object.entries(pages).forEach(([key, element]) => {
        if (!element) return;
        if (key === pageKey) {
            element.classList.remove('hidden');
        } else {
            element.classList.add('hidden');
        }
    });
}

function setDashboardTab(tabKey) {
    if (!adminView || !participantView) return;

    const isAdmin = tabKey === 'admin';
    tabAdmin?.classList.toggle('active', isAdmin);
    tabParticipants?.classList.toggle('active', !isAdmin);
    adminView.classList.toggle('hidden', !isAdmin);
    participantView.classList.toggle('hidden', isAdmin);
}

function updateDashboard(profile) {
    document.getElementById('userDisplayName').textContent = profile.fullName;
    document.getElementById('dashboardFullName').textContent = profile.fullName;
    document.getElementById('dashboardUsername').textContent = profile.username;
    document.getElementById('dashboardEmail').textContent = profile.email;

    const joinDate = profile.createdAt ? new Date(profile.createdAt) : new Date();
    document.getElementById('dashboardJoinDate').textContent = formatDate(joinDate);
    document.getElementById('dashboardBirthDate').textContent = profile.birthDate || '-';
    document.getElementById('dashboardAge').textContent = profile.age ?? '-';
    document.getElementById('dashboardGender').textContent = formatGender(profile.gender);
    document.getElementById('dashboardRegion').textContent = profile.region || '-';
    document.getElementById('dashboardConditions').textContent = formatConditions(profile.conditions);
    document.getElementById('dashboardStatus').textContent = formatStatus(profile.status);
    document.getElementById('dashboardNotes').textContent = profile.notes || '-';
    participantCountEl.textContent = participants.length.toString();

    syncEditFormWithProfile();
    renderParticipantTable();
}

// Utility: Email validation
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isStrongPassword(password) {
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>_\-+=\[\]';`~\\/]/.test(password);
    return password.length >= 8 && hasUpper && hasLower && hasNumber && hasSpecial;
}

function formatGender(value) {
    const map = {
        male: '남성',
        female: '여성',
        other: '기타/응답 안함'
    };

    return map[value] || '-';
}

function formatStatus(value) {
    const map = {
        active: '활동 중',
        paused: '일시 중단',
        completed: '참여 완료'
    };

    return map[value] || '-';
}

function normalizeConditions(value) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }

    if (typeof value === 'string') {
        return value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }

    return [];
}

function parseConditions(value) {
    return normalizeConditions(value);
}

function formatConditions(value) {
    const list = normalizeConditions(value);
    return list.length ? list.join(', ') : '-';
}

function updateAgeFromBirthdate() {
    const birthDate = birthDateInput.value;
    const age = calculateAgeFromBirthDate(birthDate);
    ageInput.value = Number.isFinite(age) ? age : '';
}

function calculateAgeFromBirthDate(birthDateString) {
    if (!birthDateString) return null;
    const birthDate = new Date(birthDateString);
    if (Number.isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const birthdayPassed =
        today.getMonth() > birthDate.getMonth() ||
        (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

    if (!birthdayPassed) {
        age -= 1;
    }

    return age;
}

function updateParticipantAgeFromBirthdate() {
    const birthDate = participantBirthDateInput.value;
    const age = calculateAgeFromBirthDate(birthDate);
    participantAgeInput.value = Number.isFinite(age) ? age : '';
}

function formatBirthAndAge(birthDate, age) {
    const birth = birthDate || '-';
    const ageText = Number.isFinite(age) ? `${age}세` : '-';
    return `${birth} / ${ageText}`;
}

function formatDateTime(value) {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('ko-KR');
}

function formatDateTimeLocal(value) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
}

function addConditionFromInput() {
    const value = conditionInput.value.trim();
    if (!value) {
        showToast('질환명을 입력한 뒤 + 버튼을 눌러주세요.', 'warning');
        return;
    }

    if (conditionList.includes(value)) {
        showToast('이미 추가된 질환명입니다.', 'warning');
        conditionInput.value = '';
        return;
    }

    conditionList.push(value);
    conditionInput.value = '';
    renderConditionChips();
}

function renderConditionChips() {
    conditionChips.innerHTML = '';

    if (!conditionList.length) {
        const empty = document.createElement('span');
        empty.className = 'chip-empty';
        empty.textContent = '질환명을 추가해주세요.';
        conditionChips.appendChild(empty);
        return;
    }

    conditionList.forEach((item, index) => {
        const chip = document.createElement('div');
        chip.className = 'condition-chip';

        const text = document.createElement('span');
        text.textContent = item;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.setAttribute('aria-label', `${item} 삭제`);
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.addEventListener('click', () => removeCondition(index));

        chip.append(text, removeBtn);
        conditionChips.appendChild(chip);
    });
}

function removeCondition(index) {
    conditionList.splice(index, 1);
    renderConditionChips();
}

function openEditModal() {
    if (!currentUser) return;
    syncEditFormWithProfile();
    editProfileModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

function closeEditModal() {
    editProfileModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
}

function syncEditFormWithProfile() {
    editStatus.value = currentUser?.status || 'active';
    editRegion.value = currentUser?.region || '';
    editNotes.value = currentUser?.notes || '';
    editConditionList = normalizeConditions(currentUser?.conditions);
    renderEditConditionChips();
}

function handleProfileUpdate(event) {
    event.preventDefault();
    if (!currentUser) return;

    const updatedRegion = editRegion.value.trim();
    const updatedStatus = editStatus.value;
    const updatedNotes = editNotes.value.trim();
    const updatedConditions = [...editConditionList];

    if (!updatedRegion) {
        showToast('거주지역을 입력해주세요.', 'error');
        return;
    }

    if (!updatedConditions.length) {
        showToast('질환명을 하나 이상 입력해주세요.', 'error');
        return;
    }

    const updates = {
        region: updatedRegion,
        status: updatedStatus,
        notes: updatedNotes,
        conditions: updatedConditions
    };

    updateUserProfile(updates)
        .then(() => {
            currentUser = {
                ...currentUser,
                ...updates
            };
            updateDashboard(currentUser);
            showToast('프로필이 업데이트되었습니다.', 'success');
            closeEditModal();
        })
        .catch((error) => {
            console.error('Profile update error:', error);
            showToast(getFirestoreErrorMessage(error), 'error');
        });
}

async function updateUserProfile(updates) {
    try {
        await setDoc(doc(db, 'users', currentUser.uid), updates, { merge: true });
    } catch (error) {
        if (isFirestorePermissionError(error)) {
            console.warn('Skip profile update due to Firestore permissions');
            return;
        }
        throw error;
    }
}

function addEditConditionFromInput() {
    const value = editConditionInput.value.trim();
    if (!value) {
        showToast('질환명을 입력한 뒤 + 버튼을 눌러주세요.', 'warning');
        return;
    }

    if (editConditionList.includes(value)) {
        showToast('이미 추가된 질환명입니다.', 'warning');
        editConditionInput.value = '';
        return;
    }

    editConditionList.push(value);
    editConditionInput.value = '';
    renderEditConditionChips();
}

function renderEditConditionChips() {
    editConditionChips.innerHTML = '';

    if (!editConditionList.length) {
        const empty = document.createElement('span');
        empty.className = 'chip-empty';
        empty.textContent = '질환명을 추가해주세요.';
        editConditionChips.appendChild(empty);
        return;
    }

    editConditionList.forEach((item, index) => {
        const chip = document.createElement('div');
        chip.className = 'condition-chip';

        const text = document.createElement('span');
        text.textContent = item;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.setAttribute('aria-label', `${item} 삭제`);
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.addEventListener('click', () => removeEditCondition(index));

        chip.append(text, removeBtn);
        editConditionChips.appendChild(chip);
    });
}

function removeEditCondition(index) {
    editConditionList.splice(index, 1);
    renderEditConditionChips();
}

function renderParticipantTable() {
    if (!participantTableBody) return;
    participantTableBody.innerHTML = '';

    if (!participants.length) {
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'empty-row';
        const td = document.createElement('td');
        td.colSpan = 11;
        td.textContent = '등록된 참가자가 없습니다. 오른쪽 상단의 참가자 추가 버튼을 눌러 새 데이터를 입력하세요.';
        emptyRow.appendChild(td);
        participantTableBody.appendChild(emptyRow);
        participantCountEl.textContent = '0';
        return;
    }

    participantCountEl.textContent = participants.length.toString();

    participants.forEach((participant) => {
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>${participant.fullName || '-'}</td>
            <td>${participant.email || '-'}</td>
            <td>${formatDate(participant.createdAt || '')}</td>
            <td>${formatBirthAndAge(participant.birthDate, participant.age)}</td>
            <td>${formatGender(participant.gender)}</td>
            <td>${participant.region || '-'}</td>
            <td>${formatConditions(participant.conditions)}</td>
            <td><span class="participant-status ${participant.status || 'active'}">${formatStatus(participant.status)}</span></td>
            <td>${participant.notes || '-'}</td>
            <td>${formatDateTime(participant.lastSeen)}</td>
            <td class="table-actions"></td>
        `;

        const actionsCell = tr.querySelector('.table-actions');
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'icon-button';
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.setAttribute('aria-label', `${participant.fullName || '참가자'} 수정`);
        editBtn.addEventListener('click', () => openParticipantModal('edit', participant));

        actionsCell.appendChild(editBtn);
        participantTableBody.appendChild(tr);
    });
}

function openParticipantModal(mode = 'add', participant = null) {
    editingParticipantId = mode === 'edit' ? participant?.id : null;
    participantModalTitle.textContent = mode === 'edit' ? '참가자 수정' : '참가자 추가';

    if (mode === 'edit' && participant) {
        participantNameInput.value = participant.fullName || '';
        participantEmailInput.value = participant.email || '';
        participantBirthDateInput.value = participant.birthDate || '';
        participantAgeInput.value = participant.age ?? '';
        participantGenderInput.value = participant.gender || '';
        participantRegionInput.value = participant.region || '';
        participantStatusInput.value = participant.status || 'active';
        participantLastSeenInput.value = formatDateTimeLocal(participant.lastSeen);
        participantNotesInput.value = participant.notes || '';
        participantConditionList = normalizeConditions(participant.conditions);
    } else {
        participantForm.reset();
        participantAgeInput.value = '';
        participantConditionList = [];
        participantStatusInput.value = 'active';
    }

    renderParticipantConditionChips();
    participantModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

function closeParticipantModal() {
    participantModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    participantForm.reset();
    participantAgeInput.value = '';
    participantConditionList = [];
    renderParticipantConditionChips();
}

async function handleParticipantSubmit(event) {
    event.preventDefault();
    if (!currentUser) return;

    const fullName = participantNameInput.value.trim();
    const email = participantEmailInput.value.trim();
    const birthDate = participantBirthDateInput.value;
    const age = calculateAgeFromBirthDate(birthDate);
    participantAgeInput.value = Number.isFinite(age) ? age : '';
    const gender = participantGenderInput.value;
    const region = participantRegionInput.value.trim();
    const status = participantStatusInput.value;
    const lastSeenValue = participantLastSeenInput.value;
    const notes = participantNotesInput.value.trim();
    const conditions = [...participantConditionList];

    if (!fullName || !email || !birthDate || !gender || !region || !status) {
        showToast('필수 항목을 모두 입력해주세요.', 'error');
        return;
    }

    if (!conditions.length) {
        showToast('질환명을 하나 이상 입력해주세요.', 'error');
        return;
    }

    if (!Number.isFinite(age) || age < 0) {
        showToast('생년월일을 올바르게 입력해주세요.', 'error');
        return;
    }

    const payload = {
        adminId: currentUser.uid,
        fullName,
        email,
        birthDate,
        age: Number(age),
        gender,
        region,
        status,
        notes,
        conditions,
        updatedAt: serverTimestamp()
    };

    if (lastSeenValue) {
        payload.lastSeen = new Date(lastSeenValue);
    }

    try {
        if (editingParticipantId) {
            await updateDoc(doc(db, 'participants', editingParticipantId), payload);
            showToast('참가자 정보가 수정되었습니다.', 'success');
        } else {
            await addDoc(collection(db, 'participants'), {
                ...payload,
                createdAt: serverTimestamp()
            });
            showToast('새 참가자가 추가되었습니다.', 'success');
        }

        await loadParticipants();
        closeParticipantModal();
    } catch (error) {
        console.error('Participant save error:', error);
        showToast(getFirestoreErrorMessage(error), 'error');
    }
}

function addParticipantConditionFromInput() {
    const value = participantConditionInput.value.trim();
    if (!value) {
        showToast('질환명을 입력한 뒤 + 버튼을 눌러주세요.', 'warning');
        return;
    }

    if (participantConditionList.includes(value)) {
        showToast('이미 추가된 질환명입니다.', 'warning');
        participantConditionInput.value = '';
        return;
    }

    participantConditionList.push(value);
    participantConditionInput.value = '';
    renderParticipantConditionChips();
}

function renderParticipantConditionChips() {
    if (!participantConditionChips) return;
    participantConditionChips.innerHTML = '';

    if (!participantConditionList.length) {
        const empty = document.createElement('span');
        empty.className = 'chip-empty';
        empty.textContent = '질환명을 추가해주세요.';
        participantConditionChips.appendChild(empty);
        return;
    }

    participantConditionList.forEach((item, index) => {
        const chip = document.createElement('div');
        chip.className = 'condition-chip';

        const text = document.createElement('span');
        text.textContent = item;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.setAttribute('aria-label', `${item} 삭제`);
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.addEventListener('click', () => removeParticipantCondition(index));

        chip.append(text, removeBtn);
        participantConditionChips.appendChild(chip);
    });
}

function removeParticipantCondition(index) {
    participantConditionList.splice(index, 1);
    renderParticipantConditionChips();
}

// Utility: Auth error mapping
function getAuthErrorMessage(error) {
    const code = error?.code || '';
    const messages = {
        'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
        'auth/invalid-email': '올바른 이메일 주소를 입력해주세요.',
        'auth/user-not-found': '등록되지 않은 이메일입니다.',
        'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
        'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
        'auth/too-many-requests': '시도 횟수가 많습니다. 잠시 후 다시 시도해주세요.',
        'auth/popup-closed-by-user': '로그인 창이 닫혔습니다. 다시 시도해주세요.',
        'auth/cancelled-popup-request': '다른 로그인 시도가 진행 중입니다. 잠시 후 다시 시도해주세요.',
        'auth/popup-blocked': '브라우저에서 팝업이 차단되었습니다. 팝업을 허용하거나 새 창에서 다시 시도해주세요.',
        'auth/operation-not-supported-in-this-environment': '현재 브라우저에서 팝업 로그인을 지원하지 않습니다. 다른 로그인 방법을 시도해주세요.',
        'auth/unauthorized-domain': '현재 도메인이 Firebase 인증에 허용되지 않았습니다. Firebase 콘솔의 인증 → 설정 → 허용된 도메인에 이 도메인을 추가해주세요.',
        'permission-denied': '데이터베이스 권한이 없습니다. Firestore 보안 규칙에서 읽기/쓰기 권한을 확인해주세요.'
    };

    return messages[code] || '인증 처리 중 오류가 발생했습니다.';
}

// Utility: Firestore error mapping
function getFirestoreErrorMessage(error) {
    const code = error?.code || '';
    const messages = {
        'permission-denied': '데이터베이스 권한이 없어 프로필을 불러오지 못했습니다. Firestore 보안 규칙에 현재 도메인/사용자가 접근 가능하도록 설정해주세요.'
    };

    return messages[code] || '프로필 정보를 불러오는 중 문제가 발생했습니다.';
}

// Utility: Fallback profile when Firestore is unavailable
function buildFallbackProfile(user) {
    return {
        uid: user.uid,
        email: user.email,
        fullName: user.displayName || user.email?.split('@')[0] || '사용자',
        username: user.email?.split('@')[0] || 'user',
        birthDate: '',
        age: null,
        gender: '',
        region: '',
        conditions: [],
        status: 'active',
        notes: '',
        createdAt: user.metadata?.creationTime ? new Date(user.metadata.creationTime) : new Date()
    };
}

// Utility: Check Firestore permission errors
function isFirestorePermissionError(error) {
    return error?.code === 'permission-denied';
}

// Utility: Username availability with graceful fallback when Firestore 권한이 없을 때
async function checkUsernameAvailability(username) {
    try {
        const usernameQuery = query(collection(db, 'users'), where('username', '==', username));
        const usernameSnapshot = await getDocs(usernameQuery);
        return usernameSnapshot.empty;
    } catch (error) {
        if (isFirestorePermissionError(error)) {
            // Firestore가 막혀도 회원가입은 진행할 수 있도록 빈 값을 반환
            showToast(getFirestoreErrorMessage(error), 'warning');
            return null;
        }
        throw error;
    }
}

// Utility: Save profile when Firestore 권한이 있을 때만 시도
async function saveProfileIfAllowed(uid, profile) {
    try {
        await setDoc(doc(db, 'users', uid), profile);
    } catch (error) {
        if (!isFirestorePermissionError(error)) {
            throw error;
        }

        console.warn('Skip profile persistence due to Firestore permissions');
    }
}

// Utility: Format date
function formatDate(date) {
    if (!date) return '-';
    const parsed = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsed.getTime())) return '-';
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    return parsed.toLocaleDateString('ko-KR', options);
}

// Show toast notification
function showToast(message, type = 'info') {
    toastMessage.textContent = message;
    toast.className = 'toast';

    if (type === 'success' || type === 'error' || type === 'warning') {
        toast.classList.add(type);
    }

    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}
