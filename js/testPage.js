import {
    testParticipantSelect,
    testScenarioSelect,
    testParticipatedAtInput,
    testTotalPlayTimeInput,
    testRetryCountInput,
    testMissionList,
    testAddRecordBtn,
    testRecordTableBody,
    testNotesInput
} from './domElements.js';
import { state } from './state.js';
import {
    formatDateTime,
    formatDateTimeLocal,
    formatDifficulty,
    formatDurationSeconds,
    getFirestoreErrorMessage,
    isFirestorePermissionError,
    showToast
} from './utils.js';
import { addDoc, collection, getDocs, query, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { db } from './firebaseConfig.js';
import { normalizeContentRecord, renderContentTable } from './contents.js';

const DEFAULT_TOTAL_PLAY_TIME = 300;
const CONTENT_COLLECTION = 'contents';

let isSavingTestRecord = false;

function buildOption(value, label) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
}

function getScenarioById(id) {
    return state.scenarios.find((item) => item.id === id || item.uid === id);
}

function getParticipantById(id) {
    return state.participants.find((item) => item.id === id || item.uid === id);
}

function sortRecords(records) {
    return [...records].sort((a, b) => {
        const aTime = a.participatedAt?.getTime?.() || 0;
        const bTime = b.participatedAt?.getTime?.() || 0;
        return bTime - aTime;
    });
}

function ensureDefaultDateTime() {
    if (!testParticipatedAtInput) return;

    const now = new Date();
    testParticipatedAtInput.value = formatDateTimeLocal(now);
}

function renderMissionInputs(scenarioId) {
    if (!testMissionList) return;

    const scenario = getScenarioById(scenarioId);
    const missions = Array.isArray(scenario?.missions) ? scenario.missions : [];

    testMissionList.innerHTML = '';

    if (!missions.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-helper';
        empty.textContent = '선택한 시나리오에 미션 정보가 없습니다. 총 플레이 시간과 비고만으로 완료 처리됩니다.';
        testMissionList.appendChild(empty);
        return;
    }

    missions.forEach((mission, index) => {
        const row = document.createElement('div');
        row.className = 'mission-input-row';

        const title = document.createElement('div');
        title.className = 'mission-title';
        title.innerHTML = `<span class="badge">${index + 1}</span>${mission.name || '미션'}`;

        const controls = document.createElement('div');
        controls.className = 'mission-controls';

        const statusSelect = document.createElement('select');
        statusSelect.dataset.missionName = mission.name || `mission-${index + 1}`;
        statusSelect.innerHTML = `
            <option value="completed">완료</option>
            <option value="skipped">건너뜀</option>
            <option value="failed">실패</option>
        `;

        const durationInput = document.createElement('input');
        durationInput.type = 'number';
        durationInput.min = '0';
        durationInput.value = '60';
        durationInput.dataset.missionName = mission.name || `mission-${index + 1}`;
        durationInput.placeholder = '소요 시간(초)';

        controls.append(statusSelect, durationInput);
        row.append(title, controls);
        testMissionList.appendChild(row);
    });
}

function readMissionStatuses() {
    if (!testMissionList) return { statuses: [], durations: [] };

    const statusSelects = Array.from(testMissionList.querySelectorAll('select'));
    const durationInputs = Array.from(testMissionList.querySelectorAll('input[type="number"]'));

    const statuses = statusSelects.map((select) => ({
        name: select.dataset.missionName || '',
        status: select.value
    }));

    const missionDurations = durationInputs.map((input) => Number(input.value) || 0);

    return { statuses, missionDurations };
}

export function renderTestOptions() {
    if (testParticipantSelect) {
        testParticipantSelect.innerHTML = '';
        testParticipantSelect.append(buildOption('', '참가자 선택'));
        state.participants.forEach((participant) => {
            testParticipantSelect.append(
                buildOption(participant.id || participant.uid, `${participant.fullName || '이름 없음'} (${participant.email || '이메일 없음'})`)
            );
        });
    }

    if (testScenarioSelect) {
        testScenarioSelect.innerHTML = '';
        testScenarioSelect.append(buildOption('', '시나리오 선택'));
        state.scenarios.forEach((scenario) => {
            testScenarioSelect.append(
                buildOption(scenario.id || scenario.uid, `${scenario.title || '제목 없음'} · ${formatDifficulty(scenario.difficulty)}`)
            );
        });

        const firstScenario = state.scenarios[0];
        if (firstScenario && !testScenarioSelect.value) {
            testScenarioSelect.value = firstScenario.id || firstScenario.uid;
        }
    }

    ensureDefaultDateTime();
    renderMissionInputs(testScenarioSelect?.value);
}

export async function loadTestRecords() {
    if (!state.currentUser) return;

    try {
        const testQuery = query(collection(db, CONTENT_COLLECTION), where('adminId', '==', state.currentUser.uid));
        const snapshot = await getDocs(testQuery);
        const records = snapshot.docs.map((docSnap) => normalizeContentRecord(docSnap.data(), docSnap.id));
        state.contents = records;
        state.testRecords = sortRecords(records);
        renderTestRecordTable();
        renderContentTable();
    } catch (error) {
        if (!isFirestorePermissionError(error)) {
            console.error('Test records load error:', error);
            showToast(getFirestoreErrorMessage(error), 'error');
        }
    }
}

export function renderTestRecordTable() {
    if (!testRecordTableBody) return;

    testRecordTableBody.innerHTML = '';

    if (!state.testRecords.length) {
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'empty-row';
        const td = document.createElement('td');
        td.colSpan = 6;
        td.textContent = '아직 등록된 테스트 기록이 없습니다. 오른쪽 폼에서 참가자와 시나리오를 선택해 완료 데이터를 입력하세요.';
        emptyRow.appendChild(td);
        testRecordTableBody.appendChild(emptyRow);
        return;
    }

    state.testRecords.forEach((record) => {
        const participant = getParticipantById(record.participantUid);
        const scenario = getScenarioById(record.scenarioUid);
        const missionSummary = record.missionStatuses.length
            ? record.missionStatuses.map((item) => `${item.name}: ${item.status}`).join(', ')
            : '미션 없음';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${participant?.fullName || '알 수 없음'}</td>
            <td>${scenario?.title || '알 수 없음'}</td>
            <td>${formatDateTime(record.participatedAt)}</td>
            <td>${formatDurationSeconds(record.totalPlayTime)}</td>
            <td>${record.retryCount ?? 0}</td>
            <td>${missionSummary}</td>
        `;

        testRecordTableBody.appendChild(tr);
    });
}

function validateTestForm() {
    const participantUid = testParticipantSelect?.value || '';
    const scenarioUid = testScenarioSelect?.value || '';
    const participatedAt = testParticipatedAtInput?.value;
    const totalPlayTime = Number(testTotalPlayTimeInput?.value || DEFAULT_TOTAL_PLAY_TIME);
    const retryCount = Number(testRetryCountInput?.value || 0);

    if (!participantUid) {
        showToast('참가자를 선택해주세요.', 'error');
        return null;
    }

    if (!scenarioUid) {
        showToast('시나리오를 선택해주세요.', 'error');
        return null;
    }

    if (!participatedAt) {
        showToast('완료 일시를 입력해주세요.', 'error');
        return null;
    }

    if (totalPlayTime < 0 || retryCount < 0) {
        showToast('플레이 시간과 재도전 횟수는 0 이상이어야 합니다.', 'error');
        return null;
    }

    return { participantUid, scenarioUid, participatedAt: new Date(participatedAt), totalPlayTime, retryCount };
}

function setSavingState(isSaving) {
    isSavingTestRecord = isSaving;
    if (testAddRecordBtn) {
        testAddRecordBtn.disabled = isSaving;
        testAddRecordBtn.classList.toggle('loading', isSaving);
    }
}

async function persistTestRecord(record) {
    const { id: _recordId, ...cleanRecord } = record;
    const payload = { ...cleanRecord, adminId: state.currentUser.uid, createdAt: serverTimestamp() };

    const docRef = await addDoc(collection(db, CONTENT_COLLECTION), payload);
    return { ...cleanRecord, adminId: state.currentUser.uid, id: docRef.id };
}

function resetTestForm() {
    if (testTotalPlayTimeInput) {
        testTotalPlayTimeInput.value = DEFAULT_TOTAL_PLAY_TIME.toString();
    }

    if (testRetryCountInput) {
        testRetryCountInput.value = '0';
    }

    if (testNotesInput) {
        testNotesInput.value = '';
    }

    ensureDefaultDateTime();
    renderMissionInputs(testScenarioSelect?.value);
}

export function wireTestPageEvents(onRecordAdded) {
    testScenarioSelect?.addEventListener('change', (event) => {
        const scenarioId = event.target.value;
        renderMissionInputs(scenarioId);
    });

    testAddRecordBtn?.addEventListener('click', async (event) => {
        event.preventDefault();

        if (!state.currentUser) {
            showToast('로그인 후 이용해주세요.', 'error');
            return;
        }

        if (isSavingTestRecord) return;

        const result = validateTestForm();
        if (!result) return;

        const { statuses, missionDurations } = readMissionStatuses();

        const record = {
            participantUid: result.participantUid,
            scenarioUid: result.scenarioUid,
            participatedAt: result.participatedAt,
            totalPlayTime: result.totalPlayTime,
            retryCount: result.retryCount,
            missionStatuses: statuses,
            missionDurations,
            notes: testNotesInput?.value?.trim() || ''
        };

        try {
            setSavingState(true);
            const savedRecord = await persistTestRecord(record);
            state.testRecords = sortRecords([savedRecord, ...state.testRecords]);
            state.contents = sortRecords([savedRecord, ...state.contents]);
            renderTestRecordTable();
            renderContentTable();
            showToast('테스트용 콘텐츠 완료 기록이 추가되었습니다.', 'success');
            resetTestForm();
            onRecordAdded?.(savedRecord);
        } catch (error) {
            console.error('Test record save error:', error);
            showToast(getFirestoreErrorMessage(error), 'error');
        } finally {
            setSavingState(false);
        }
    });
}

export function refreshTestPage() {
    renderTestOptions();
    renderTestRecordTable();
}
