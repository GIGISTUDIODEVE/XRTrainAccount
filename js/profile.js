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

import { db } from './firebaseConfig.js';
import {
    editAffiliation,
    editEmail,
    editFullName,
    editJoinDate,
    editParticipantCount,
    editPosition,
    editProfileBtn,
    editProfileForm,
    editProfileModal,
    closeEditModalBtn,
    cancelEditBtn
} from './domElements.js';
import { state } from './state.js';
import {
    buildFallbackProfile,
    getFirestoreErrorMessage,
    isFirestorePermissionError,
    showToast,
    formatDate,
    normalizeConditions
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
    editFullName.value = state.currentUser?.fullName || '';
    editEmail.value = state.currentUser?.email || '';
    editAffiliation.value = state.currentUser?.affiliation || '';
    editPosition.value = state.currentUser?.position || '';

    const joinDate = state.currentUser?.createdAt ? new Date(state.currentUser.createdAt) : new Date();
    editJoinDate.value = formatDate(joinDate);
    editParticipantCount.value = state.participants.length.toString();
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

    const updatedFullName = editFullName.value.trim();
    const updatedAffiliation = editAffiliation.value.trim();
    const updatedPosition = editPosition.value.trim();

    if (!updatedFullName) {
        showToast('이름을 입력해주세요.', 'error');
        return;
    }

    const updates = {
        fullName: updatedFullName,
        affiliation: updatedAffiliation,
        position: updatedPosition
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
}
