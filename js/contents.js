import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { db } from './firebaseConfig.js';
import { loadScenarios } from './scenarios.js';
import {
    contentNextPageBtn,
    contentPageNumbers,
    contentPrevPageBtn,
    contentDateFromInput,
    contentDateToInput,
    contentSearchInput,
    contentScenarioFilterSelect,
    contentDifficultyFilterSelect,
    contentSortButtons,
    contentTableBody,
    contentTableScroll,
    contentDetailBody,
    contentDetailModal,
    closeContentDetailModalBtn,
    dismissContentDetailBtn,
    refreshContentsBtn,
    contentStatsSection,
    contentStatsMessage,
    contentStatsTotal,
    contentStatsSuccess,
    contentStatsFailure,
    contentStatsRate
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
const DEFAULT_MONTH_RANGE = 3;
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

function getScenarioDifficultyKey(scenarioUid) {
    const scenario = state.scenarios.find((item) => item.id === scenarioUid || item.uid === scenarioUid);
    return scenario?.difficulty || '';
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
        totalPlayTime: Number.isFinite(data.totalPlayTime) ? data.totalPlayTime : 0,
        notes: typeof data.notes === 'string' ? data.notes : ''
    };
}

export async function loadContents() {
    if (!state.currentUser) return;

    try {
        const contentsQuery = query(collection(db, 'contents'), where('adminId', '==', state.currentUser.uid));
        const snapshot = await getDocs(contentsQuery);
        state.contents = snapshot.docs.map((docSnap) => normalizeContentRecord(docSnap.data(), docSnap.id));
        initializeDefaultContentDateRange();
        updateContentPageAfterLoad(state.contents.length);
    } catch (error) {
        if (!isFirestorePermissionError(error)) {
            console.error('Contents load error:', error);
            showToast(getFirestoreErrorMessage(error), 'error');
        }
    }
}

function updateContentPageAfterLoad(totalCount = state.contents.length) {
    if (!totalCount) {
        state.contentPage = 1;
        return;
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / CONTENT_PAGE_SIZE));
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

function getFilteredContents() {
    initializeDefaultContentDateRange();
    const fromDate = parseDateStart(state.contentDateFrom);
    const toDate = parseDateEnd(state.contentDateTo);
    const query = (state.contentSearchQuery || '').trim().toLowerCase();
    const scenarioFilter = state.contentScenarioFilter || '';
    const difficultyFilter = state.contentDifficultyFilter || '';
    const baseRecords = state.contents.filter((record) => {
        const participatedAt = record.participatedAt ? new Date(record.participatedAt) : null;
        const participatedTime = participatedAt?.getTime();

        if (fromDate && (!participatedTime || participatedTime < fromDate.getTime())) return false;
        if (toDate && (!participatedTime || participatedTime > toDate.getTime())) return false;
        if (scenarioFilter && record.scenarioUid !== scenarioFilter) return false;
        if (difficultyFilter && getScenarioDifficultyKey(record.scenarioUid) !== difficultyFilter) return false;
        return true;
    });

    if (!query) return baseRecords;

    return baseRecords.filter((record) => {
        const participantName = getParticipantName(record.participantUid).toLowerCase();
        return participantName.includes(query);
    });
}

function getSortedContents(records = getFilteredContents()) {
    const sortKey = state.contentSortKey || 'participatedAt';
    const sortDirection = state.contentSortDirection || DEFAULT_SORT_DIRECTION[sortKey] || 'desc';
    const sortableRecords = [...records];

    sortableRecords.sort((a, b) => {
        const aValue = getSortValue(a, sortKey);
        const bValue = getSortValue(b, sortKey);
        return compareValues(aValue, bValue, sortDirection);
    });

    return sortableRecords;
}

export function renderContentTable() {
    if (!contentTableBody) return;
    initializeDefaultContentDateRange();
    syncContentDateInputs();
    syncContentFilterInputs();
    if (contentSearchInput) {
        contentSearchInput.value = state.contentSearchQuery;
    }
    contentTableBody.innerHTML = '';

    const filteredRecords = getFilteredContents();
    const areFiltersActive = areAllContentFiltersActive();
    updateContentPageAfterLoad(filteredRecords.length);
    const sortedRecords = getSortedContents(filteredRecords);
    const totalPages = Math.ceil(sortedRecords.length / CONTENT_PAGE_SIZE);
    const hasContents = Boolean(sortedRecords.length);

    if (!hasContents) {
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'empty-row';
        const td = document.createElement('td');
        td.colSpan = 7;
        const hasSearchQuery = Boolean((state.contentSearchQuery || '').trim());
        const hasDateFilter = Boolean(state.contentDateFrom || state.contentDateTo);
        const hasFilters = hasSearchQuery || hasDateFilter;
        td.textContent = hasFilters
            ? '조건에 맞는 콘텐츠 기록이 없습니다. 검색어와 기간을 조정해보세요.'
            : '콘텐츠 기록이 없습니다. 시나리오 진행 후 데이터가 저장되면 이곳에서 확인할 수 있습니다.';
        emptyRow.appendChild(td);
        contentTableBody.appendChild(emptyRow);
        renderContentPagination(totalPages, hasContents);
        syncContentSortIndicators();
        renderContentStats(filteredRecords, areFiltersActive);
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

        const detailTd = document.createElement('td');
        const detailButton = document.createElement('button');
        detailButton.type = 'button';
        detailButton.className = 'content-detail-button';
        detailButton.textContent = '자세히';
        detailButton.addEventListener('click', () => openContentDetailModal(record));
        detailTd.appendChild(detailButton);
        tr.appendChild(detailTd);

        contentTableBody.appendChild(tr);
    });

    renderContentPagination(totalPages, hasContents);
    syncContentSortIndicators();
    renderContentStats(filteredRecords, areFiltersActive);
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
        await loadScenarios();
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
        const totalPages = Math.max(1, Math.ceil(getFilteredContents().length / CONTENT_PAGE_SIZE));
        if (state.contentPage >= totalPages) return;
        state.contentPage += 1;
        renderContentTable();
    });

    contentSearchInput?.addEventListener('input', (event) => {
        state.contentSearchQuery = event.target.value || '';
        state.contentPage = 1;
        renderContentTable();
    });

    contentDateFromInput?.addEventListener('change', (event) => {
        handleContentDateChange('from', event.target.value || '');
    });

    contentDateToInput?.addEventListener('change', (event) => {
        handleContentDateChange('to', event.target.value || '');
    });

    contentScenarioFilterSelect?.addEventListener('change', (event) => {
        state.contentScenarioFilter = event.target.value || '';
        state.contentPage = 1;
        renderContentTable();
    });

    contentDifficultyFilterSelect?.addEventListener('change', (event) => {
        state.contentDifficultyFilter = event.target.value || '';
        state.contentPage = 1;
        renderContentTable();
    });

    setupContentSorting();
    setupContentDetailModal();
}

function handleContentDateChange(type, nextValue) {
    const fromCandidate = type === 'from' ? nextValue : state.contentDateFrom;
    const toCandidate = type === 'to' ? nextValue : state.contentDateTo;
    const fromDate = parseDateStart(fromCandidate);
    const toDate = parseDateEnd(toCandidate);

    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
        showToast('시작일이 종료일보다 늦을 수 없습니다.', 'warning');
        syncContentDateInputs();
        return;
    }

    if (type === 'from') {
        state.contentDateFrom = nextValue;
    } else {
        state.contentDateTo = nextValue;
    }

    state.contentPage = 1;
    renderContentTable();
}

function initializeDefaultContentDateRange() {
    if (state.contentDateFrom && state.contentDateTo) return;

    const { from, to } = getDefaultDateRange();
    state.contentDateFrom = state.contentDateFrom || from;
    state.contentDateTo = state.contentDateTo || to;
}

function getDefaultDateRange() {
    const today = new Date();
    const start = new Date(today);
    start.setMonth(start.getMonth() - DEFAULT_MONTH_RANGE);
    return {
        from: formatDateInputValue(start),
        to: formatDateInputValue(today)
    };
}

function parseDateStart(value) {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateEnd(value) {
    if (!value) return null;
    const date = new Date(`${value}T23:59:59.999`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function syncContentDateInputs() {
    if (contentDateFromInput) {
        contentDateFromInput.value = state.contentDateFrom || '';
    }
    if (contentDateToInput) {
        contentDateToInput.value = state.contentDateTo || '';
    }
}

function syncContentFilterInputs() {
    populateScenarioFilterOptions();

    if (contentDifficultyFilterSelect) {
        const allowed = ['', 'easy', 'medium', 'hard'];
        if (!allowed.includes(state.contentDifficultyFilter)) {
            state.contentDifficultyFilter = '';
        }
        contentDifficultyFilterSelect.value = state.contentDifficultyFilter;
    }

    if (contentScenarioFilterSelect) {
        contentScenarioFilterSelect.value = state.contentScenarioFilter;
    }
}

function populateScenarioFilterOptions() {
    if (!contentScenarioFilterSelect) return;

    const previousValue = state.contentScenarioFilter || '';
    contentScenarioFilterSelect.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '전체 시나리오';
    contentScenarioFilterSelect.appendChild(defaultOption);

    const options = state.scenarios
        .map((scenario) => ({
            value: scenario.id || scenario.uid || '',
            label: scenario.title || '제목 없음'
        }))
        .filter((item) => item.value)
        .sort((a, b) => a.label.localeCompare(b.label, 'ko'));

    options.forEach((option) => {
        const optionEl = document.createElement('option');
        optionEl.value = option.value;
        optionEl.textContent = option.label;
        contentScenarioFilterSelect.appendChild(optionEl);
    });

    const hasPrevious = options.some((option) => option.value === previousValue);
    const nextValue = hasPrevious ? previousValue : '';
    state.contentScenarioFilter = nextValue;
    contentScenarioFilterSelect.value = nextValue;
}

function areAllContentFiltersActive() {
    const hasSearch = Boolean((state.contentSearchQuery || '').trim());
    const hasScenario = Boolean(state.contentScenarioFilter);
    const hasDifficulty = Boolean(state.contentDifficultyFilter);
    const hasDateRange = Boolean(state.contentDateFrom) && Boolean(state.contentDateTo);
    return hasSearch && hasScenario && hasDifficulty && hasDateRange;
}

function calculateContentStats(records) {
    const total = records.length;
    const success = records.filter(isContentRecordSuccessful).length;
    const failure = Math.max(total - success, 0);
    const successRate = total ? Math.round((success / total) * 1000) / 10 : 0;
    return { total, success, failure, successRate };
}

function isContentRecordSuccessful(record) {
    const missions = Array.isArray(record.missionStatuses) ? record.missionStatuses : [];
    if (!missions.length) return false;
    return missions.every((mission) => mission?.status === 'completed');
}

function renderContentStats(records, filtersActive) {
    if (
        !contentStatsSection ||
        !contentStatsMessage ||
        !contentStatsTotal ||
        !contentStatsSuccess ||
        !contentStatsFailure ||
        !contentStatsRate
    ) {
        return;
    }

    if (!filtersActive) {
        contentStatsSection.classList.add('inactive');
        contentStatsMessage.textContent = '참가자 검색, 시나리오, 난이도, 기간을 모두 설정하면 요약을 확인할 수 있습니다.';
        contentStatsTotal.textContent = '0';
        contentStatsSuccess.textContent = '0';
        contentStatsFailure.textContent = '0';
        contentStatsRate.textContent = '0%';
        return;
    }

    const { total, success, failure, successRate } = calculateContentStats(records);
    const hasRecords = total > 0;

    contentStatsSection.classList.toggle('inactive', !hasRecords);
    contentStatsTotal.textContent = total.toLocaleString('ko-KR');
    contentStatsSuccess.textContent = success.toLocaleString('ko-KR');
    contentStatsFailure.textContent = failure.toLocaleString('ko-KR');
    contentStatsRate.textContent = `${successRate.toFixed(1)}%`;
    contentStatsMessage.textContent = hasRecords
        ? '현재 선택한 조건에 맞는 기록의 요약입니다.'
        : '조건에 맞는 기록이 없어 요약을 계산할 수 없습니다.';
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

function setupContentDetailModal() {
    closeContentDetailModalBtn?.addEventListener('click', closeContentDetailModal);
    dismissContentDetailBtn?.addEventListener('click', closeContentDetailModal);
    contentDetailModal?.addEventListener('click', (event) => {
        if (event.target === contentDetailModal) {
            closeContentDetailModal();
        }
    });
}

function closeContentDetailModal() {
    if (!contentDetailModal) return;
    contentDetailModal.classList.add('hidden');
    contentDetailModal.setAttribute('aria-hidden', 'true');
}

function openContentDetailModal(record) {
    if (!contentDetailModal || !contentDetailBody) return;

    const participantName = getParticipantName(record.participantUid);
    const scenarioInfo = getScenarioMeta(record.scenarioUid);
    const missionDetails = buildMissionDetailList(record);
    const missionCount = Math.max(record.missionStatuses?.length || 0, record.missionDurations?.length || 0);
    const retryCount = Number.isFinite(record.retryCount) ? record.retryCount : 0;
    const totalPlayTime = Number.isFinite(record.totalPlayTime) ? record.totalPlayTime : 0;
    const notes = record.notes?.trim() ? record.notes.trim() : '등록된 비고가 없습니다.';

    contentDetailBody.innerHTML = `
        <div class="content-detail-grid">
            <div class="content-detail-field">
                <div class="content-detail-label">참가자</div>
                <div class="content-detail-value">${participantName}</div>
            </div>
            <div class="content-detail-field">
                <div class="content-detail-label">시나리오</div>
                <div class="content-detail-value">${scenarioInfo.title}</div>
            </div>
            <div class="content-detail-field">
                <div class="content-detail-label">난이도</div>
                <div class="content-detail-value">${scenarioInfo.difficulty}</div>
            </div>
            <div class="content-detail-field">
                <div class="content-detail-label">참가 일시</div>
                <div class="content-detail-value">${formatDateTime(record.participatedAt)}</div>
            </div>
            <div class="content-detail-field">
                <div class="content-detail-label">총 플레이 시간</div>
                <div class="content-detail-value">${formatDurationSeconds(totalPlayTime)}</div>
            </div>
            <div class="content-detail-field">
                <div class="content-detail-label">재도전 횟수</div>
                <div class="content-detail-value">${retryCount}</div>
            </div>
            <div class="content-detail-field">
                <div class="content-detail-label">미션 개수</div>
                <div class="content-detail-value">${missionCount || '미션 없음'}</div>
            </div>
        </div>

        <div class="mission-detail-section">
            <div class="mission-detail-header">
                <h3>미션 상세</h3>
                <span class="content-detail-value muted">${missionCount ? `${missionCount}개 미션` : '등록된 미션 없음'}</span>
            </div>
            <ul class="mission-detail-list">${missionDetails}</ul>
            <div class="content-detail-note"><strong>비고</strong><br>${notes}</div>
        </div>

        <div class="content-detail-footer">
            <span>기록 ID: ${record.id || '—'}</span>
            <span>관리자: ${record.adminId || '—'}</span>
        </div>
    `;

    contentDetailModal.classList.remove('hidden');
    contentDetailModal.setAttribute('aria-hidden', 'false');
}

function buildMissionDetailList(record) {
    const missionCount = Math.max(record.missionStatuses?.length || 0, record.missionDurations?.length || 0);

    if (!missionCount) {
        return '<li class="empty-helper">등록된 미션 정보가 없습니다.</li>';
    }

    const items = [];
    for (let index = 0; index < missionCount; index += 1) {
        const mission = record.missionStatuses?.[index] || {};
        const missionName = mission?.name || `미션 ${index + 1}`;
        const statusLabel = mission?.status || '상태 없음';
        const durationText = getMissionDurationText(record, index);

        items.push(`
            <li class="mission-detail-item">
                <div class="mission-name">${missionName}</div>
                <div class="mission-meta">
                    <span class="mission-status">${statusLabel}</span>
                    <span>${durationText}</span>
                </div>
            </li>
        `);
    }

    return items.join('');
}

function getMissionDurationText(record, index) {
    const value = record.missionDurations?.[index];
    if (!Number.isFinite(value)) return '소요 시간 정보 없음';
    return `소요 시간 ${formatDurationSeconds(value)}`;
}
