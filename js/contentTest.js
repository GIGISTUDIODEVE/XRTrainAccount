import { addDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { auth, db } from './firebaseConfig.js';
import { showToast } from './utils.js';

const authStatus = document.getElementById('authStatus');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');

const contentTestForm = document.getElementById('contentTestForm');
const adminIdInput = document.getElementById('adminId');
const participantUidInput = document.getElementById('participantUid');
const scenarioUidInput = document.getElementById('scenarioUid');
const scenarioTitleInput = document.getElementById('scenarioTitle');
const scenarioDifficultySelect = document.getElementById('scenarioDifficulty');
const participatedAtInput = document.getElementById('participatedAt');
const retryCountInput = document.getElementById('retryCount');
const totalPlayTimeInput = document.getElementById('totalPlayTime');
const missionList = document.getElementById('missionList');
const addMissionBtn = document.getElementById('addMissionBtn');
const fillSampleBtn = document.getElementById('fillSample');
const logPanel = document.getElementById('logPanel');

const MAX_EXPECTED_ITEMS = 3;

function setLog(message) {
    if (logPanel) {
        logPanel.textContent = message;
    }
}

function setAuthStatus(text, isSuccess = false) {
    if (!authStatus) return;
    authStatus.textContent = text;
    authStatus.className = `login-status ${isSuccess ? 'success' : ''}`;
}

async function handleLogin() {
    const email = authEmail?.value?.trim();
    const password = authPassword?.value || '';

    if (!email || !password) {
        showToast('이메일과 비밀번호를 입력하세요.', 'error');
        return;
    }

    try {
        setLog('로그인 중...');
        await signInWithEmailAndPassword(auth, email, password);
        showToast('로그인 성공', 'success');
    } catch (error) {
        console.error('Login failed:', error);
        showToast('로그인 실패: ' + (error?.message || '알 수 없는 오류'), 'error');
        setLog('로그인 실패');
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        showToast('로그아웃되었습니다.', 'success');
        setLog('로그아웃 완료');
    } catch (error) {
        console.error('Logout failed:', error);
        showToast('로그아웃 실패', 'error');
    }
}

function onAuthChange(user) {
    if (user) {
        setAuthStatus(`로그인: ${user.email || user.uid}`, true);
    } else {
        setAuthStatus('로그인 필요');
    }
}

function createExpectedList(title, listClass) {
    const wrapper = document.createElement('div');
    wrapper.className = 'expected-list';

    const header = document.createElement('div');
    header.className = 'expected-header';
    header.innerHTML = `<span>${title}</span>`;
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'icon-button';
    addBtn.innerHTML = '<i class="fas fa-plus"></i>';
    header.appendChild(addBtn);

    const list = document.createElement('div');
    list.className = `expected-items ${listClass}`;
    list.innerHTML = '<div class="chip-empty">항목을 추가하세요.</div>';

    addBtn.addEventListener('click', () => {
        addExpectedItem(list);
    });

    wrapper.appendChild(header);
    wrapper.appendChild(list);
    return { wrapper, list };
}

function addExpectedItem(list) {
    if (!list) return;
    const items = Array.from(list.querySelectorAll('.expected-item'));
    if (items.length >= MAX_EXPECTED_ITEMS) {
        showToast(`최대 ${MAX_EXPECTED_ITEMS}개까지 입력할 수 있습니다.`, 'warning');
        return;
    }

    if (items.length === 0) {
        list.innerHTML = '';
    }

    const row = document.createElement('div');
    row.className = 'expected-item';
    row.innerHTML = `
        <input type="text" class="expected-input" placeholder="내용 입력">
        <button type="button" class="icon-button" aria-label="삭제"><i class="fas fa-times"></i></button>
    `;

    row.querySelector('button')?.addEventListener('click', () => {
        row.remove();
        if (!list.querySelector('.expected-item')) {
            list.innerHTML = '<div class="chip-empty">항목을 추가하세요.</div>';
        }
    });

    list.appendChild(row);
}

function addMissionForm(defaults = {}) {
    if (!missionList) return;
    if (missionList.querySelector('.chip-empty')) {
        missionList.innerHTML = '';
    }

    const card = document.createElement('div');
    card.className = 'mission-card editable';
    card.innerHTML = `
        <div class="mission-card-header">
            <div class="mission-title-row">
                <div class="input-group inline">
                    <i class="fas fa-list-ol"></i>
                    <input type="text" class="mission-name" placeholder="미션 이름" required>
                </div>
                <button type="button" class="icon-button" aria-label="미션 삭제"><i class="fas fa-times"></i></button>
            </div>
            <div class="mission-meta">
                <label class="toggle">
                    <input type="checkbox" class="mission-success">
                    <span>성공</span>
                </label>
                <div class="input-group inline">
                    <i class="fas fa-stopwatch"></i>
                    <input type="number" class="mission-answer-time" min="0" step="0.1" placeholder="답변 시간(초)">
                </div>
            </div>
        </div>
    `;

    const { wrapper: questionsWrapper, list: questionsList } = createExpectedList('예상 질문', 'questions');
    const { wrapper: answersWrapper, list: answersList } = createExpectedList('예상 답변', 'answers');

    const expectedArea = document.createElement('div');
    expectedArea.className = 'expected-area';
    expectedArea.appendChild(questionsWrapper);
    expectedArea.appendChild(answersWrapper);

    card.appendChild(expectedArea);
    missionList.appendChild(card);

    const nameInput = card.querySelector('.mission-name');
    const successInput = card.querySelector('.mission-success');
    const answerTimeInput = card.querySelector('.mission-answer-time');
    const removeBtn = card.querySelector('.icon-button');

    removeBtn?.addEventListener('click', () => {
        card.remove();
        if (!missionList.querySelector('.mission-card')) {
            missionList.innerHTML = '<div class="chip-empty">미션을 추가하세요.</div>';
        }
    });

    if (defaults.name) nameInput.value = defaults.name;
    if (typeof defaults.success === 'boolean') successInput.checked = defaults.success;
    if (Number.isFinite(defaults.answerTimeSeconds)) answerTimeInput.value = defaults.answerTimeSeconds;
    (defaults.expectedQuestions || []).slice(0, MAX_EXPECTED_ITEMS).forEach((item) => {
        addExpectedItem(questionsList);
        const last = questionsList.querySelector('.expected-item:last-child input');
        if (last) last.value = item;
    });
    (defaults.expectedAnswers || []).slice(0, MAX_EXPECTED_ITEMS).forEach((item) => {
        addExpectedItem(answersList);
        const last = answersList.querySelector('.expected-item:last-child input');
        if (last) last.value = item;
    });
}

function serializeExpected(list) {
    if (!list) return [];
    const values = [];
    list.querySelectorAll('.expected-item input').forEach((input) => {
        const value = input.value.trim();
        if (value) values.push(value);
    });
    return values.slice(0, MAX_EXPECTED_ITEMS);
}

function serializeMissions() {
    const missions = [];
    missionList?.querySelectorAll('.mission-card').forEach((card) => {
        const name = card.querySelector('.mission-name')?.value?.trim();
        if (!name) return;

        const success = card.querySelector('.mission-success')?.checked || false;
        const answerTime = parseFloat(card.querySelector('.mission-answer-time')?.value || '0');
        const questions = serializeExpected(card.querySelector('.expected-items.questions'));
        const answers = serializeExpected(card.querySelector('.expected-items.answers'));

        missions.push({
            name,
            success,
            expectedQuestions: questions,
            expectedAnswers: answers,
            answerTimeSeconds: Number.isFinite(answerTime) && answerTime > 0 ? answerTime : 0
        });
    });
    return missions;
}

async function handleSubmit(event) {
    event.preventDefault();

    if (!contentTestForm.checkValidity()) {
        contentTestForm.reportValidity();
        return;
    }

    const missions = serializeMissions();
    if (!missions.length) {
        showToast('미션을 최소 1개 이상 입력하세요.', 'error');
        return;
    }

    const participatedAtValue = participatedAtInput?.value;
    const date = participatedAtValue ? new Date(participatedAtValue) : new Date();

    const payload = {
        adminId: adminIdInput?.value?.trim() || '',
        participantUid: participantUidInput?.value?.trim() || '',
        scenarioUid: scenarioUidInput?.value?.trim() || '',
        scenarioTitle: scenarioTitleInput?.value?.trim() || '',
        scenarioDifficulty: scenarioDifficultySelect?.value || 'easy',
        participatedAt: Timestamp.fromDate(date),
        retryCount: Math.max(0, parseInt(retryCountInput?.value || '0', 10)),
        missionAttempts: missions,
        missionStatuses: missions.map((m) => ({ name: m.name, success: m.success })),
        missionDurations: missions.map((m) => ({ name: m.name, answerTimeSeconds: m.answerTimeSeconds })),
        totalPlayTime: Math.max(0, parseFloat(totalPlayTimeInput?.value || '0'))
    };

    try {
        setLog('Firestore에 저장 중...');
        const docRef = await addDoc(collection(db, 'contents'), payload);
        showToast('저장 성공', 'success');
        setLog(`저장 완료: 문서 ID ${docRef.id}\n페이로드:\n${JSON.stringify(payload, null, 2)}`);
    } catch (error) {
        console.error('Save failed:', error);
        showToast('저장 실패: ' + (error?.message || '알 수 없는 오류'), 'error');
        setLog('저장 실패: ' + (error?.message || '오류 확인'));
    }
}

function fillSampleValues() {
    const now = new Date();
    const isoLocal = now.toISOString().slice(0, 16);
    if (adminIdInput) adminIdInput.value = 's4V7nkQgV8RTY0ZDEoc6pKJBoqu1';
    if (participantUidInput) participantUidInput.value = 'test-participant-001';
    if (scenarioUidInput) scenarioUidInput.value = 'scenario-elevator';
    if (scenarioTitleInput) scenarioTitleInput.value = '엘리베이터';
    if (scenarioDifficultySelect) scenarioDifficultySelect.value = 'easy';
    if (participatedAtInput) participatedAtInput.value = isoLocal;
    if (retryCountInput) retryCountInput.value = '1';
    if (totalPlayTimeInput) totalPlayTimeInput.value = '120';

    missionList.innerHTML = '';
    addMissionForm({
        name: '인사하기',
        success: true,
        answerTimeSeconds: 15,
        expectedQuestions: ['안녕하세요'],
        expectedAnswers: ['안녕하세요, 반갑습니다.']
    });
    addMissionForm({
        name: '자기소개',
        success: false,
        answerTimeSeconds: 30,
        expectedQuestions: ['자기소개 해주세요'],
        expectedAnswers: ['저는 테스트 참가자입니다.']
    });
}

function initDefaultDate() {
    const now = new Date();
    const isoLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    if (participatedAtInput) participatedAtInput.value = isoLocal;
}

function initEvents() {
    addMissionBtn?.addEventListener('click', () => addMissionForm());
    fillSampleBtn?.addEventListener('click', fillSampleValues);
    loginBtn?.addEventListener('click', handleLogin);
    logoutBtn?.addEventListener('click', handleLogout);
    contentTestForm?.addEventListener('submit', handleSubmit);
    onAuthStateChanged(auth, onAuthChange);
}

initDefaultDate();
initEvents();

// 초기 상태 미션 1개 추가
addMissionForm({ name: '기본 미션', success: true });
