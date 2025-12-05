import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import { auth, db } from './firebaseConfig.js';
import {
    editAddConditionBtn,
    editConditionChips,
    editConditionInput,
    editNotes,
    editProfileBtn,
    editProfileForm,
    editProfileModal,
    editRegion,
    editStatus,
    closeEditModalBtn,
    cancelEditBtn
} from './domElements.js';
import { state } from './state.js';
import {
    buildFallbackProfile,
    getFirestoreErrorMessage,
    isFirestorePermissionError,
    normalizeConditions,
    showToast
} from './utils.js';

export async function loadUserProfile(user) {
    try {
        const profileRef = doc(db, 'users', user.uid);
        const profileSnap = await getDoc(profileRef);

        if (profileSnap.exists()) {
            const data = profileSnap.data();
            state.currentUser = {
                uid: user.uid,
                email: user.email,
                fullName: data.fullName || user.displayName || '사용자',
                username: data.username || user.email?.split('@')[0] || 'user',
                affiliation: data.affiliation || '',
                position: data.position || '',
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

        state.currentUser = buildFallbackProfile(user);
        await saveProfileIfAllowed(user.uid, {
            fullName: state.currentUser.fullName,
            username: state.currentUser.username,
            email: state.currentUser.email,
            affiliation: state.currentUser.affiliation,
            position: state.currentUser.position,
            birthDate: state.currentUser.birthDate,
            age: state.currentUser.age,
            gender: state.currentUser.gender,
            region: state.currentUser.region,
            conditions: state.currentUser.conditions,
            status: state.currentUser.status,
            notes: state.currentUser.notes,
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Profile load error:', error);
        state.currentUser = buildFallbackProfile(user);
        if (!isFirestorePermissionError(error)) {
            throw error;
        }
    }
}

export function syncEditFormWithProfile() {
    editStatus.value = state.currentUser?.status || 'active';
    editRegion.value = state.currentUser?.region || '';
    editNotes.value = state.currentUser?.notes || '';
    state.editConditionList = normalizeConditions(state.currentUser?.conditions);
    renderEditConditionChips();
}

export function openEditModal() {
    if (!state.currentUser) return;
    syncEditFormWithProfile();
    editProfileModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

export function closeEditModal() {
    editProfileModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
}

export function handleProfileUpdate(event, onUpdated) {
    event.preventDefault();
    if (!state.currentUser) return;

    const updatedRegion = editRegion.value.trim();
    const updatedStatus = editStatus.value;
    const updatedNotes = editNotes.value.trim();
    const updatedConditions = [...state.editConditionList];

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
            state.currentUser = {
                ...state.currentUser,
                ...updates
            };
            onUpdated?.(state.currentUser);
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
        await setDoc(doc(db, 'users', state.currentUser.uid), updates, { merge: true });
    } catch (error) {
        if (isFirestorePermissionError(error)) {
            console.warn('Skip profile update due to Firestore permissions');
            return;
        }
        throw error;
    }
}

export function addEditConditionFromInput() {
    const value = editConditionInput.value.trim();
    if (!value) {
        showToast('질환명을 입력한 뒤 + 버튼을 눌러주세요.', 'warning');
        return;
    }

    if (state.editConditionList.includes(value)) {
        showToast('이미 추가된 질환명입니다.', 'warning');
        editConditionInput.value = '';
        return;
    }

    state.editConditionList.push(value);
    editConditionInput.value = '';
    renderEditConditionChips();
}

function renderEditConditionChips() {
    editConditionChips.innerHTML = '';

    if (!state.editConditionList.length) {
        const empty = document.createElement('span');
        empty.className = 'chip-empty';
        empty.textContent = '질환명을 추가해주세요.';
        editConditionChips.appendChild(empty);
        return;
    }

    state.editConditionList.forEach((item, index) => {
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
    state.editConditionList.splice(index, 1);
    renderEditConditionChips();
}

export async function checkUsernameAvailability(username) {
    try {
        const usernameQuery = query(collection(db, 'users'), where('username', '==', username));
        const usernameSnapshot = await getDocs(usernameQuery);
        return usernameSnapshot.empty;
    } catch (error) {
        if (isFirestorePermissionError(error)) {
            showToast(getFirestoreErrorMessage(error), 'warning');
            return null;
        }
        throw error;
    }
}

export async function saveProfileIfAllowed(uid, profile) {
    try {
        await setDoc(doc(db, 'users', uid), profile);
    } catch (error) {
        if (!isFirestorePermissionError(error)) {
            throw error;
        }

        console.warn('Skip profile persistence due to Firestore permissions');
    }
}

export function wireProfileEvents(onProfileUpdated) {
    editProfileBtn?.addEventListener('click', openEditModal);
    closeEditModalBtn?.addEventListener('click', closeEditModal);
    cancelEditBtn?.addEventListener('click', closeEditModal);
    editProfileForm?.addEventListener('submit', (event) => handleProfileUpdate(event, onProfileUpdated));
    editAddConditionBtn?.addEventListener('click', addEditConditionFromInput);
    editConditionInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addEditConditionFromInput();
        }
    });
}
