import {
    addDoc,
    collection,
    doc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc,
    where
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import { db } from './firebaseConfig.js';
import {
    addParticipantBtn,
    cancelParticipantBtn,
    closeParticipantModalBtn,
    participantAddConditionBtn,
    participantAgeInput,
    participantBirthDateInput,
    participantConditionChips,
    participantConditionInput,
    participantCountEl,
    participantEmailInput,
    participantForm,
    participantGenderInput,
    participantLastSeenInput,
    participantModal,
    participantModalTitle,
    participantNameInput,
    participantNotesInput,
    participantRegionInput,
    participantSearchInput,
    participantStatusInput,
    participantTableBody
} from './domElements.js';
import { state } from './state.js';
import {
    calculateAgeFromBirthDate,
    formatBirthAndAge,
    formatConditions,
    formatDate,
    formatDateTime,
    formatDateTimeLocal,
    formatGender,
    formatStatus,
    getFirestoreErrorMessage,
    isFirestorePermissionError,
    normalizeConditions,
    showToast
} from './utils.js';

export async function loadParticipants() {
    if (!state.currentUser) return;
    try {
        const participantsQuery = query(collection(db, 'participants'), where('adminId', '==', state.currentUser.uid));
        const snapshot = await getDocs(participantsQuery);
        state.participants = snapshot.docs.map((docSnap) => {
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
}

export function renderParticipantTable() {
    if (!participantTableBody) return;
    participantTableBody.innerHTML = '';

    const filteredParticipants = getFilteredParticipants();

    if (!filteredParticipants.length) {
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'empty-row';
        const td = document.createElement('td');
        td.colSpan = 11;
        if (state.participants.length === 0) {
            td.textContent = '등록된 참가자가 없습니다. 오른쪽 상단의 참가자 추가 버튼을 눌러 새 데이터를 입력하세요.';
        } else {
            td.textContent = '검색 결과가 없습니다. 이름 철자를 확인하거나 다른 키워드로 검색해보세요.';
        }
        emptyRow.appendChild(td);
        participantTableBody.appendChild(emptyRow);
        participantCountEl.textContent = state.participants.length.toString();
        return;
    }

    participantCountEl.textContent = state.participants.length.toString();

    filteredParticipants.forEach((participant) => {
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

function getFilteredParticipants() {
    const query = state.participantSearchQuery?.trim().toLowerCase();
    if (!query) {
        return state.participants;
    }

    return state.participants.filter((participant) => (participant.fullName || '').toLowerCase().includes(query));
}

export function openParticipantModal(mode = 'add', participant = null) {
    state.editingParticipantId = mode === 'edit' ? participant?.id : null;
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
        state.participantConditionList = normalizeConditions(participant.conditions);
    } else {
        participantForm.reset();
        participantAgeInput.value = '';
        state.participantConditionList = [];
        participantStatusInput.value = 'active';
    }

    renderParticipantConditionChips();
    participantModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

export function closeParticipantModal() {
    participantModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    participantForm.reset();
    participantAgeInput.value = '';
    state.participantConditionList = [];
    renderParticipantConditionChips();
}

export async function handleParticipantSubmit(event, onParticipantsUpdated) {
    event.preventDefault();
    if (!state.currentUser) return;

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
    const conditions = [...state.participantConditionList];

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
        adminId: state.currentUser.uid,
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
        if (state.editingParticipantId) {
            await updateDoc(doc(db, 'participants', state.editingParticipantId), payload);
            showToast('참가자 정보가 수정되었습니다.', 'success');
        } else {
            await addDoc(collection(db, 'participants'), {
                ...payload,
                createdAt: serverTimestamp()
            });
            showToast('새 참가자가 추가되었습니다.', 'success');
        }

        await loadParticipants();
        onParticipantsUpdated?.();
        closeParticipantModal();
    } catch (error) {
        console.error('Participant save error:', error);
        showToast(getFirestoreErrorMessage(error), 'error');
    }
}

export function addParticipantConditionFromInput() {
    const value = participantConditionInput.value.trim();
    if (!value) {
        showToast('질환명을 입력한 뒤 + 버튼을 눌러주세요.', 'warning');
        return;
    }

    if (state.participantConditionList.includes(value)) {
        showToast('이미 추가된 질환명입니다.', 'warning');
        participantConditionInput.value = '';
        return;
    }

    state.participantConditionList.push(value);
    participantConditionInput.value = '';
    renderParticipantConditionChips();
}

export function renderParticipantConditionChips() {
    participantConditionChips.innerHTML = '';

    if (!state.participantConditionList.length) {
        const empty = document.createElement('span');
        empty.className = 'chip-empty';
        empty.textContent = '질환명을 추가해주세요.';
        participantConditionChips.appendChild(empty);
        return;
    }

    state.participantConditionList.forEach((item, index) => {
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
    state.participantConditionList.splice(index, 1);
    renderParticipantConditionChips();
}

export function wireParticipantEvents(onParticipantsUpdated) {
    addParticipantBtn?.addEventListener('click', () => openParticipantModal('add'));
    closeParticipantModalBtn?.addEventListener('click', closeParticipantModal);
    cancelParticipantBtn?.addEventListener('click', closeParticipantModal);
    participantForm?.addEventListener('submit', (event) => handleParticipantSubmit(event, onParticipantsUpdated));
    participantBirthDateInput?.addEventListener('change', () => updateParticipantAgeFromBirthdate());
    participantAddConditionBtn?.addEventListener('click', addParticipantConditionFromInput);
    participantConditionInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addParticipantConditionFromInput();
        }
    });

    participantSearchInput?.addEventListener('input', handleParticipantSearchInput);

    renderParticipantConditionChips();
}

function handleParticipantSearchInput() {
    state.participantSearchQuery = participantSearchInput.value;
    renderParticipantTable();
}

function updateParticipantAgeFromBirthdate() {
    const birthDate = participantBirthDateInput.value;
    const age = calculateAgeFromBirthDate(birthDate);
    participantAgeInput.value = Number.isFinite(age) ? age : '';
}
