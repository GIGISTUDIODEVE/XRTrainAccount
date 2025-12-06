import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { db } from './firebaseConfig.js';
import { contentTableBody, refreshContentsBtn } from './domElements.js';
import { state } from './state.js';
import {
    formatDateTime,
    formatDifficulty,
    formatDurationSeconds,
    getFirestoreErrorMessage,
    isFirestorePermissionError,
    showToast
} from './utils.js';

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

function normalizeContentRecord(data, id) {
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
    } catch (error) {
        if (!isFirestorePermissionError(error)) {
            console.error('Contents load error:', error);
            showToast(getFirestoreErrorMessage(error), 'error');
        }
    }
}

export function renderContentTable() {
    if (!contentTableBody) return;
    contentTableBody.innerHTML = '';

    if (!state.contents.length) {
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'empty-row';
        const td = document.createElement('td');
        td.colSpan = 5;
        td.textContent = '콘텐츠 기록이 없습니다. 시나리오 진행 후 데이터가 저장되면 이곳에서 확인할 수 있습니다.';
        emptyRow.appendChild(td);
        contentTableBody.appendChild(emptyRow);
        return;
    }

    state.contents.forEach((record) => {
        const participantName = getParticipantName(record.participantUid);
        const scenarioInfo = getScenarioMeta(record.scenarioUid);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${participantName}</td>
            <td>${formatDateTime(record.participatedAt)}</td>
            <td>${scenarioInfo.title}</td>
            <td>${scenarioInfo.difficulty}</td>
            <td>${formatDurationSeconds(record.totalPlayTime)}</td>
        `;

        contentTableBody.appendChild(tr);
    });
}

export function wireContentEvents(onRefresh) {
    refreshContentsBtn?.addEventListener('click', async () => {
        await loadContents();
        renderContentTable();
        onRefresh?.();
    });
}
