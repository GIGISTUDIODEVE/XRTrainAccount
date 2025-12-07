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
    participantPrevPageBtn,
    participantNextPageBtn,
    participantPageNumbers,
    participantSortButtons,
    participantTableScroll,
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

const PARTICIPANT_PAGE_SIZE = 25;
const DEFAULT_PARTICIPANT_SORT_DIRECTION = {
    fullName: 'asc',
    email: 'asc',
    createdAt: 'desc',
    birthDate: 'desc',
    region: 'asc',
    status: 'asc',
    lastSeen: 'desc'
};

const statusOrder = {
    active: 1,
    paused: 2,
    blocked: 3
};

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

        updateParticipantPageAfterLoad();
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

    if (participantSearchInput) {
        participantSearchInput.value = state.participantSearchQuery;
    }

    const filteredParticipants = getFilteredParticipants();
    updateParticipantPageAfterLoad(filteredParticipants.length);
    const sortedParticipants = getSortedParticipants(filteredParticipants);
    const totalPages = Math.ceil(sortedParticipants.length / PARTICIPANT_PAGE_SIZE);
    const hasParticipants = Boolean(sortedParticipants.length);

    if (!hasParticipants) {
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'empty-row';
        const td = document.createElement('td');
        td.colSpan = 11;
        const hasSearchQuery = Boolean((state.participantSearchQuery || '').trim());
        td.textContent = hasSearchQuery
            ? '검색 결과가 없습니다. 이름 철자를 확인하거나 다른 키워드로 검색해보세요.'
            : '등록된 참가자가 없습니다. 오른쪽 상단의 참가자 추가 버튼을 눌러 새 데이터를 입력하세요.';
        emptyRow.appendChild(td);
        participantTableBody.appendChild(emptyRow);
        participantCountEl.textContent = state.participants.length.toString();
        renderParticipantPagination(totalPages, hasParticipants);
        syncParticipantSortIndicators();
        return;
    }

    participantCountEl.textContent = state.participants.length.toString();

    const startIndex = (state.participantPage - 1) * PARTICIPANT_PAGE_SIZE;
    const endIndex = startIndex + PARTICIPANT_PAGE_SIZE;
    const pageParticipants = sortedParticipants.slice(startIndex, endIndex);

    pageParticipants.forEach((participant) => {
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

    renderParticipantPagination(totalPages, hasParticipants);
    syncParticipantSortIndicators();
    resetParticipantScroll();
}

function getFilteredParticipants() {
    const query = state.participantSearchQuery?.trim().toLowerCase();
    if (!query) {
        return [...state.participants];
    }

    return state.participants.filter((participant) => (participant.fullName || '').toLowerCase().includes(query));
}

function getParticipantSortValue(participant, sortKey) {
    switch (sortKey) {
        case 'fullName':
            return participant.fullName || '';
        case 'email':
            return participant.email || '';
        case 'birthDate':
            return participant.birthDate ? new Date(participant.birthDate).getTime() : participant.age ?? null;
        case 'region':
            return participant.region || '';
        case 'status':
            return statusOrder[participant.status] || 0;
        case 'lastSeen':
            return participant.lastSeen ? new Date(participant.lastSeen).getTime() : null;
        case 'createdAt':
        default:
            return participant.createdAt ? new Date(participant.createdAt).getTime() : null;
    }
}

function compareParticipantValues(a, b, direction) {
    if (a === b) return 0;

    const isAsc = direction === 'asc';
    const aEmpty = a === null || a === undefined;
    const bEmpty = b === null || b === undefined;

    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return isAsc ? 1 : -1;
    if (bEmpty) return isAsc ? -1 : 1;

    if (typeof a === 'string' || typeof b === 'string') {
        const aString = String(a);
        const bString = String(b);
        return isAsc ? aString.localeCompare(bString, 'ko') : bString.localeCompare(aString, 'ko');
    }

    if (a > b) return isAsc ? 1 : -1;
    if (a < b) return isAsc ? -1 : 1;
    return 0;
}

function getSortedParticipants(records = getFilteredParticipants()) {
    const sortKey = state.participantSortKey || 'createdAt';
    const sortDirection = state.participantSortDirection || DEFAULT_PARTICIPANT_SORT_DIRECTION[sortKey] || 'desc';
    const sortableRecords = [...records];

    sortableRecords.sort((a, b) => {
        const aValue = getParticipantSortValue(a, sortKey);
        const bValue = getParticipantSortValue(b, sortKey);
        return compareParticipantValues(aValue, bValue, sortDirection);
    });

    return sortableRecords;
}

function renderParticipantPagination(totalPages, hasParticipants) {
    if (!participantPrevPageBtn || !participantNextPageBtn || !participantPageNumbers) return;

    const safeTotalPages = hasParticipants ? Math.max(totalPages, 1) : 0;
    participantPageNumbers.innerHTML = '';
    const pages = buildPageList(safeTotalPages, hasParticipants ? state.participantPage : 0);

    pages.forEach((page, index) => {
        if (page === 'ellipsis') {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'page-ellipsis';
            ellipsis.textContent = '...';
            participantPageNumbers.appendChild(ellipsis);
        } else {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `page-number${page === state.participantPage ? ' active' : ''}`;
            button.textContent = page;
            button.addEventListener('click', () => {
                if (state.participantPage === page) return;
                state.participantPage = page;
                renderParticipantTable();
            });
            participantPageNumbers.appendChild(button);
        }

        if (index < pages.length - 1) {
            const separator = document.createElement('span');
            separator.className = 'page-separator';
            separator.textContent = '.';
            participantPageNumbers.appendChild(separator);
        }
    });

    participantPrevPageBtn.disabled = !hasParticipants || state.participantPage <= 1;
    participantNextPageBtn.disabled = !hasParticipants || state.participantPage >= safeTotalPages;
}

function buildPageList(totalPages, currentPage) {
    if (totalPages <= 1) return totalPages === 1 ? [1] : [];
    if (totalPages <= 3) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages = [1];
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) {
        pages.push('ellipsis');
    }

    for (let page = start; page <= end; page += 1) {
        pages.push(page);
    }

    if (end < totalPages - 1) {
        pages.push('ellipsis');
    }

    pages.push(totalPages);
    return pages;
}

function updateParticipantPageAfterLoad(totalCount = state.participants.length) {
    if (!totalCount) {
        state.participantPage = 1;
        return;
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / PARTICIPANT_PAGE_SIZE));
    const safeCurrent = Math.min(Math.max(state.participantPage, 1), totalPages);
    state.participantPage = safeCurrent;
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
    participantPrevPageBtn?.addEventListener('click', () => {
        if (state.participantPage <= 1) return;
        state.participantPage -= 1;
        renderParticipantTable();
    });

    participantNextPageBtn?.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil(getFilteredParticipants().length / PARTICIPANT_PAGE_SIZE));
        if (state.participantPage >= totalPages) return;
        state.participantPage += 1;
        renderParticipantTable();
    });

    setupParticipantSorting();

    renderParticipantConditionChips();
}

function handleParticipantSearchInput() {
    state.participantSearchQuery = participantSearchInput.value;
    state.participantPage = 1;
    renderParticipantTable();
}

function setupParticipantSorting() {
    if (!participantSortButtons?.length) return;

    participantSortButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const sortKey = button.dataset.sortKey;
            if (!sortKey) return;
            handleParticipantSortChange(sortKey);
        });
    });

    syncParticipantSortIndicators();
}

function handleParticipantSortChange(sortKey) {
    const isSameKey = state.participantSortKey === sortKey;
    const defaultDirection = DEFAULT_PARTICIPANT_SORT_DIRECTION[sortKey] || 'asc';
    const nextDirection = isSameKey
        ? state.participantSortDirection === 'asc'
            ? 'desc'
            : 'asc'
        : defaultDirection;

    state.participantSortKey = sortKey;
    state.participantSortDirection = nextDirection;
    state.participantPage = 1;
    renderParticipantTable();
}

function syncParticipantSortIndicators() {
    if (!participantSortButtons?.length) return;

    participantSortButtons.forEach((button) => {
        const sortKey = button.dataset.sortKey;
        const icon = button.querySelector('.sort-icon');
        const isActive = sortKey === state.participantSortKey;

        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');

        if (!icon) return;

        if (!isActive) {
            icon.textContent = '↕';
            icon.setAttribute('aria-label', '정렬');
            return;
        }

        const isAsc = state.participantSortDirection === 'asc';
        icon.textContent = isAsc ? '▲' : '▼';
        icon.setAttribute('aria-label', isAsc ? '오름차순' : '내림차순');
    });
}

function resetParticipantScroll() {
    if (participantTableScroll) {
        participantTableScroll.scrollTop = 0;
    }
}

function updateParticipantAgeFromBirthdate() {
    const birthDate = participantBirthDateInput.value;
    const age = calculateAgeFromBirthDate(birthDate);
    participantAgeInput.value = Number.isFinite(age) ? age : '';
}
