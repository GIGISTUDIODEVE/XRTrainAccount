import {
    browserLocalPersistence,
    browserSessionPersistence,
    createUserWithEmailAndPassword,
    getRedirectResult,
    GoogleAuthProvider,
    onAuthStateChanged,
    updateProfile,
    sendPasswordResetEmail,
    setPersistence,
    signInWithEmailAndPassword,
    signInWithPopup,
    signInWithRedirect,
    signOut
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import { auth } from './firebaseConfig.js';
import {
    addConditionBtn,
    birthDateInput,
    conditionInput,
    forgotPasswordLink,
    googleLoginBtn,
    loginFormElement,
    showLoginBtn,
    showSignupBtn,
    signupFormElement,
    logoutBtn
} from './domElements.js';
import { state } from './state.js';
import {
    calculateAgeFromBirthDate,
    getAuthErrorMessage,
    getFirestoreErrorMessage,
    isValidEmail,
    isStrongPassword,
    showToast,
    resetAuthForms
} from './utils.js';
import {
    checkUsernameAvailability,
    loadUserProfile,
    saveProfileIfAllowed
} from './profile.js';
import { loadParticipants } from './participants.js';
import { loadScenarios } from './scenarios.js';
import { loadContents } from './contents.js';
import { setActivePage, showAuth, showDashboard } from './navigation.js';

export function wireAuthEvents() {
    showSignupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        switchToSignup();
    });

    showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        switchToLogin();
    });

    loginFormElement.addEventListener('submit', handleLogin);
    signupFormElement.addEventListener('submit', handleSignup);
    forgotPasswordLink?.addEventListener('click', handlePasswordReset);
    googleLoginBtn?.addEventListener('click', handleGoogleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    birthDateInput.addEventListener('change', updateAgeFromBirthdate);
    addConditionBtn.addEventListener('click', addConditionFromInput);
    conditionInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addConditionFromInput();
        }
    });
    signupFormElement.addEventListener('reset', () => {
        state.conditionList = [];
        renderConditionChips();
        document.getElementById('signupAge').value = '';
    });

    renderConditionChips();
}

export function initAuthListeners(onReady) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                await loadUserProfile(user);
                await loadParticipants();
                await loadScenarios();
                await loadContents();
            } catch (error) {
                console.error('Profile load error (onAuthStateChanged):', error);
                showToast(getFirestoreErrorMessage(error), 'warning');
            }

            showDashboard();
        } else {
            state.currentUser = null;
            showAuth();
        }

        onReady?.();
    });
}

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

async function handleSignup(e) {
    e.preventDefault();

    const fullName = document.getElementById('signupFullName').value.trim();
    const username = document.getElementById('signupUsername').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const birthDate = birthDateInput.value;
    const age = calculateAgeFromBirthDate(birthDate);
    document.getElementById('signupAge').value = Number.isFinite(age) ? age : '';
    const gender = document.getElementById('signupGender').value;
    const region = document.getElementById('signupRegion').value.trim();
    const conditions = [...state.conditionList];
    const status = document.getElementById('signupStatus').value;
    const notes = document.getElementById('signupNotes').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;

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

        const credential = await createUserWithEmailAndPassword(auth, email, password);

        const userProfile = {
            username,
            fullName,
            email,
            affiliation: '',
            position: '',
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

export async function handleGoogleRedirectResult() {
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

async function handleLogout() {
    try {
        await signOut(auth);
        resetAuthForms(loginFormElement, signupFormElement);
        state.currentUser = null;
        state.participants = [];
        state.participantConditionList = [];
        state.contents = [];
        showToast('로그아웃되었습니다.', 'success');
        setTimeout(() => {
            showAuth();
        }, 500);
    } catch (error) {
        console.error('Logout error:', error);
        showToast('로그아웃 중 오류가 발생했습니다.', 'error');
    }
}

function updateAgeFromBirthdate() {
    const birthDate = birthDateInput.value;
    const age = calculateAgeFromBirthDate(birthDate);
    document.getElementById('signupAge').value = Number.isFinite(age) ? age : '';
}

async function finalizeLoginFlow(user, message) {
    try {
        await loadUserProfile(user);
        await loadParticipants();
        await loadScenarios();
        await loadContents();
    } catch (error) {
        showToast(getFirestoreErrorMessage(error), 'warning');
    }

    showToast(message, 'success');
    showDashboard();
}

function switchToSignup() {
    setActivePage('signup');
}

function switchToLogin() {
    setActivePage('login');
}

function addConditionFromInput() {
    const value = conditionInput.value.trim();
    if (!value) {
        showToast('질환명을 입력한 뒤 + 버튼을 눌러주세요.', 'warning');
        return;
    }

    if (state.conditionList.includes(value)) {
        showToast('이미 추가된 질환명입니다.', 'warning');
        conditionInput.value = '';
        return;
    }

    state.conditionList.push(value);
    conditionInput.value = '';
    renderConditionChips();
}

function renderConditionChips() {
    const conditionChips = document.getElementById('conditionChips');
    conditionChips.innerHTML = '';

    if (!state.conditionList.length) {
        const empty = document.createElement('span');
        empty.className = 'chip-empty';
        empty.textContent = '질환명을 추가해주세요.';
        conditionChips.appendChild(empty);
        return;
    }

    state.conditionList.forEach((item, index) => {
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
    state.conditionList.splice(index, 1);
    renderConditionChips();
}
