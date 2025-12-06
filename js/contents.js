import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { db } from './firebaseConfig.js';
import {
    contentNextPageBtn,
    contentPageNumbers,
    contentPrevPageBtn,
    contentSortButtons,
    contentTableBody,
    contentTableScroll,
    refreshContentsBtn
} from './domElements.js';
import { state } from './state.js';
import {
    formatDateTime,
    formatDifficulty,
    formatDurationSeconds,
    getFirestoreErrorMessage,
    isFirestorePermissionError,
    showToast
} from './utils.js';

const CONTENT_PAGE_SIZE = 25;
const DEFAULT_SORT_DIRECTION = {
    participantName: 'asc',
    participatedAt: 'desc',
    scenarioTitle: 'asc',
    difficulty: 'asc',
    totalPlayTime: 'desc'
};
const difficultyOrder = {
    easy: 1,
    medium: 2,
    hard: 3
};

function getParticipantName(participantUid) {
    const participant = state.participants.find((item) => item.id === participantUid || item.uid === participantUid);
    return participant?.fullName || '알 수 없음';
}

function getScenarioMeta(scenarioUid) {
    const scenario = state.scenarios.find((item) => item.id === scenarioUid || item.uid === scenarioUid);
    return {
        title: scenario?.title || '알 수 없음',
        difficulty: formatDifficulty(scenario?.difficulty)
    };
}

export function normalizeContentRecord(data, id) {
    return {
        id,
        adminId: data.adminId || '',
        participantUid: data.participantUid || '',
        scenarioUid: data.scenarioUid || '',
        participatedAt: data.participatedAt?.toDate ? data.participatedAt.toDate() : data.participatedAt,
        missionStatuses: Array.isArray(data.missionStatuses) ? data.missionStatuses : [],
        retryCount: Number.isFinite(data.retryCount) ? data.retryCount : 0,
        missionDurations: Array.isArray(data.missionDurations) ? data.missionDurations : [],
        totalPlayTime: Number.isFinite(data.totalPlayTime) ? data.totalPlayTime : 0
    };
}

export async function loadContents() {
    if (!state.currentUser) return;

    try {
        const contentsQuery = query(collection(db, 'contents'), where('adminId', '==', state.currentUser.uid));
        const snapshot = await getDocs(contentsQuery);
        state.contents = snapshot.docs.map((docSnap) => normalizeContentRecord(docSnap.data(), docSnap.id));
        updateContentPageAfterLoad();
    } catch (error) {
        if (!isFirestorePermissionError(error)) {
            console.error('Contents load error:', error);
            showToast(getFirestoreErrorMessage(error), 'error');
        }
    }
}

function updateContentPageAfterLoad() {
    if (!state.contents.length) {
        state.contentPage = 1;
        return;
    }

    const totalPages = Math.max(1, Math.ceil(state.contents.length / CONTENT_PAGE_SIZE));
    const safeCurrent = Math.min(Math.max(state.contentPage, 1), totalPages);
    state.contentPage = safeCurrent;
}

function getScenarioDifficultyValue(scenarioUid) {
    const scenario = state.scenarios.find((item) => item.id === scenarioUid || item.uid === scenarioUid);
    return difficultyOrder[scenario?.difficulty] || 0;
}

function getSortValue(record, sortKey) {
    switch (sortKey) {
        case 'participantName':
            return getParticipantName(record.participantUid);
        case 'scenarioTitle':
            return getScenarioMeta(record.scenarioUid).title;
        case 'difficulty':
            return getScenarioDifficultyValue(record.scenarioUid);
        case 'totalPlayTime':
            return Number.isFinite(record.totalPlayTime) ? record.totalPlayTime : null;
        case 'participatedAt':
        default:
            return record.participatedAt ? new Date(record.participatedAt).getTime() : null;
    }
}

function compareValues(a, b, direction) {
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

function getSortedContents() {
    const sortKey = state.contentSortKey || 'participatedAt';
    const sortDirection = state.contentSortDirection || DEFAULT_SORT_DIRECTION[sortKey] || 'desc';
    const records = [...state.contents];

    records.sort((a, b) => {
        const aValue = getSortValue(a, sortKey);
        const bValue = getSortValue(b, sortKey);
        return compareValues(aValue, bValue, sortDirection);
    });

    return records;
}

export function renderContentTable() {
    if (!contentTableBody) return;
    updateContentPageAfterLoad();
    contentTableBody.innerHTML = '';

    const sortedRecords = getSortedContents();
    const totalPages = Math.ceil(sortedRecords.length / CONTENT_PAGE_SIZE);
    const hasContents = Boolean(sortedRecords.length);

    if (!hasContents) {
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'empty-row';
        const td = document.createElement('td');
        td.colSpan = 6;
        td.textContent = '콘텐츠 기록이 없습니다. 시나리오 진행 후 데이터가 저장되면 이곳에서 확인할 수 있습니다.';
        emptyRow.appendChild(td);
        contentTableBody.appendChild(emptyRow);
        renderContentPagination(totalPages, hasContents);
        syncContentSortIndicators();
        return;
    }

    const startIndex = (state.contentPage - 1) * CONTENT_PAGE_SIZE;
    const endIndex = startIndex + CONTENT_PAGE_SIZE;
    const pageRecords = sortedRecords.slice(startIndex, endIndex);

    pageRecords.forEach((record, index) => {
        const participantName = getParticipantName(record.participantUid);
        const scenarioInfo = getScenarioMeta(record.scenarioUid);
        const rowIndex = startIndex + index + 1;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${rowIndex}</td>
            <td>${participantName}</td>
            <td>${formatDateTime(record.participatedAt)}</td>
            <td>${scenarioInfo.title}</td>
            <td>${scenarioInfo.difficulty}</td>
            <td>${formatDurationSeconds(record.totalPlayTime)}</td>
        `;

        contentTableBody.appendChild(tr);
    });

    renderContentPagination(totalPages, hasContents);
    syncContentSortIndicators();
    resetContentScroll();
}

function renderContentPagination(totalPages, hasContents) {
    if (!contentPrevPageBtn || !contentNextPageBtn || !contentPageNumbers) return;

    const safeTotalPages = hasContents ? Math.max(totalPages, 1) : 0;

    contentPageNumbers.innerHTML = '';
    const pages = buildPageList(safeTotalPages, hasContents ? state.contentPage : 0);
    pages.forEach((page, index) => {
        if (page === 'ellipsis') {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'page-ellipsis';
            ellipsis.textContent = '...';
            contentPageNumbers.appendChild(ellipsis);
        } else {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `page-number${page === state.contentPage ? ' active' : ''}`;
            button.textContent = page;
            button.addEventListener('click', () => {
                if (state.contentPage === page) return;
                state.contentPage = page;
                renderContentTable();
            });
            contentPageNumbers.appendChild(button);
        }

        const needsSeparator = index < pages.length - 1;
        if (needsSeparator) {
            const separator = document.createElement('span');
            separator.className = 'page-separator';
            separator.textContent = '.';
            contentPageNumbers.appendChild(separator);
        }
    });

    contentPrevPageBtn.disabled = !hasContents || state.contentPage <= 1;
    contentNextPageBtn.disabled = !hasContents || state.contentPage >= safeTotalPages;
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

export function wireContentEvents(onRefresh) {
    refreshContentsBtn?.addEventListener('click', async () => {
        await loadContents();
        renderContentTable();
        onRefresh?.();
    });

    contentPrevPageBtn?.addEventListener('click', () => {
        if (state.contentPage <= 1) return;
        state.contentPage -= 1;
        renderContentTable();
    });

    contentNextPageBtn?.addEventListener('click', () => {
        const totalPages = Math.ceil(state.contents.length / CONTENT_PAGE_SIZE);
        if (state.contentPage >= totalPages) return;
        state.contentPage += 1;
        renderContentTable();
    });

    setupContentSorting();
}

function resetContentScroll() {
    if (contentTableScroll) {
        contentTableScroll.scrollTop = 0;
    }
}

function setupContentSorting() {
    if (!contentSortButtons?.length) return;

    contentSortButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const sortKey = button.dataset.sortKey;
            if (!sortKey) return;
            handleContentSortChange(sortKey);
        });
    });

    syncContentSortIndicators();
}

function handleContentSortChange(sortKey) {
    const isSameKey = state.contentSortKey === sortKey;
    const defaultDirection = DEFAULT_SORT_DIRECTION[sortKey] || 'asc';
    const nextDirection = isSameKey
        ? state.contentSortDirection === 'asc'
            ? 'desc'
            : 'asc'
        : defaultDirection;

    state.contentSortKey = sortKey;
    state.contentSortDirection = nextDirection;
    state.contentPage = 1;
    renderContentTable();
}

function syncContentSortIndicators() {
    if (!contentSortButtons?.length) return;

    contentSortButtons.forEach((button) => {
        const sortKey = button.dataset.sortKey;
        const icon = button.querySelector('.sort-icon');
        const isActive = sortKey === state.contentSortKey;

        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');

        if (!icon) return;

        if (!isActive) {
            icon.textContent = '↕';
            icon.setAttribute('aria-label', '정렬');
            return;
        }

        const isAsc = state.contentSortDirection === 'asc';
        icon.textContent = isAsc ? '▲' : '▼';
        icon.setAttribute('aria-label', isAsc ? '오름차순' : '내림차순');
    });
}
