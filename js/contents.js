import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { db } from './firebaseConfig.js';
import { contentNextPageBtn, contentPageInfo, contentPrevPageBtn, contentTableBody, contentTableScroll, refreshContentsBtn } from './domElements.js';
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

export function renderContentTable() {
    if (!contentTableBody) return;
    updateContentPageAfterLoad();
    contentTableBody.innerHTML = '';

    const totalPages = Math.ceil(state.contents.length / CONTENT_PAGE_SIZE);
    const hasContents = Boolean(state.contents.length);

    if (!hasContents) {
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'empty-row';
        const td = document.createElement('td');
        td.colSpan = 6;
        td.textContent = '콘텐츠 기록이 없습니다. 시나리오 진행 후 데이터가 저장되면 이곳에서 확인할 수 있습니다.';
        emptyRow.appendChild(td);
        contentTableBody.appendChild(emptyRow);
        renderContentPagination(totalPages);
        return;
    }

    const startIndex = (state.contentPage - 1) * CONTENT_PAGE_SIZE;
    const endIndex = startIndex + CONTENT_PAGE_SIZE;
    const pageRecords = state.contents.slice(startIndex, endIndex);

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

    renderContentPagination(totalPages);
    resetContentScroll();
}

function renderContentPagination(totalPages) {
    if (!contentPrevPageBtn || !contentNextPageBtn || !contentPageInfo) return;

    const hasContents = Boolean(state.contents.length);
    const safeTotalPages = totalPages || 0;
    const currentPage = hasContents ? state.contentPage : 0;

    contentPageInfo.textContent = `${currentPage} / ${safeTotalPages}`;
    contentPrevPageBtn.disabled = !hasContents || state.contentPage <= 1;
    contentNextPageBtn.disabled = !hasContents || state.contentPage >= safeTotalPages;
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
}

function resetContentScroll() {
    if (contentTableScroll) {
        contentTableScroll.scrollTop = 0;
    }
}
