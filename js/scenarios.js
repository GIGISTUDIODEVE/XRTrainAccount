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
    addMissionBtn,
    addScenarioBtn,
    cancelScenarioBtn,
    closeScenarioModalBtn,
    addAnswerBtn,
    addQuestionBtn,
    missionAnswersList,
    missionList,
    missionNameInput,
    missionQuestionsList,
    scenarioDifficultyInput,
    scenarioForm,
    scenarioModal,
    scenarioModalTitle,
    scenarioTableBody,
    scenarioTitleInput
} from './domElements.js';
import { state } from './state.js';
import {
    formatDate,
    formatDifficulty,
    getFirestoreErrorMessage,
    isFirestorePermissionError,
    showToast
} from './utils.js';

const MAX_EXPECTED_ITEMS = 3;

function normalizeMission(mission = {}) {
    const expectedQuestions = Array.isArray(mission.expectedQuestions) ? mission.expectedQuestions : [];
    const expectedAnswers = Array.isArray(mission.expectedAnswers) ? mission.expectedAnswers : [];

    return {
        name: mission.name?.trim() || '',
        expectedQuestions: expectedQuestions
            .map((item) => (item ?? '').toString().trim())
            .filter(Boolean)
            .slice(0, MAX_EXPECTED_ITEMS),
        expectedAnswers: expectedAnswers
            .map((item) => (item ?? '').toString().trim())
            .filter(Boolean)
            .slice(0, MAX_EXPECTED_ITEMS)
    };
}

function resetMissionForm() {
    state.editingMissionIndex = null;

    if (missionNameInput) {
        missionNameInput.value = '';
    }

    renderExpectedInputs();
    updateMissionActionState();
}

function updateMissionActionState() {
    if (!addMissionBtn) return;

    const label = addMissionBtn.querySelector('span');
    const icon = addMissionBtn.querySelector('i');
    if (state.editingMissionIndex !== null) {
        label.textContent = '미션 업데이트';
        icon.className = 'fas fa-save';
    } else {
        label.textContent = '미션 추가';
        icon.className = 'fas fa-plus';
    }
}

function getPlaceholder(type, index) {
    const label = type === 'question' ? '예상 질문' : '예상 답변';
    return `${label} ${index}`;
}

function addExpectedItem(type, value = '') {
    const container = type === 'question' ? missionQuestionsList : missionAnswersList;
    if (!container) return;

    if (container.children.length >= MAX_EXPECTED_ITEMS) {
        showToast('예상 질문/답변은 각각 최대 3개까지 입력할 수 있습니다.', 'error');
        return;
    }

    const index = container.children.length + 1;
    const row = document.createElement('div');
    row.className = 'mission-item-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = getPlaceholder(type, index);
    input.value = value;
    input.maxLength = 200;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'icon-button';
    removeBtn.setAttribute('aria-label', `${getPlaceholder(type, index)} 삭제`);
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.addEventListener('click', () => {
        row.remove();
        if (!container.children.length) {
            addExpectedItem(type);
        }
    });

    row.append(input, removeBtn);
    container.appendChild(row);
}

function renderExpectedInputs(questions = [], answers = []) {
    if (missionQuestionsList) {
        missionQuestionsList.innerHTML = '';
        const questionValues = questions.length ? questions : [''];
        questionValues.slice(0, MAX_EXPECTED_ITEMS).forEach((q) => addExpectedItem('question', q));
    }

    if (missionAnswersList) {
        missionAnswersList.innerHTML = '';
        const answerValues = answers.length ? answers : [''];
        answerValues.slice(0, MAX_EXPECTED_ITEMS).forEach((a) => addExpectedItem('answer', a));
    }
}

function getExpectedItems(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll('input'))
        .map((input) => input.value.trim())
        .filter(Boolean)
        .slice(0, MAX_EXPECTED_ITEMS);
}

export async function loadScenarios() {
    if (!state.currentUser) return;

    try {
        const scenarioQuery = query(collection(db, 'scenarios'), where('adminId', '==', state.currentUser.uid));
        const snapshot = await getDocs(scenarioQuery);
        state.scenarios = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt
            };
        });
    } catch (error) {
        if (!isFirestorePermissionError(error)) {
            console.error('Scenarios load error:', error);
            showToast(getFirestoreErrorMessage(error), 'error');
        }
    }
}

export function renderScenarioTable() {
    if (!scenarioTableBody) return;
    scenarioTableBody.innerHTML = '';

    if (!state.scenarios.length) {
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'empty-row';
        const td = document.createElement('td');
        td.colSpan = 5;
        td.textContent = '등록된 시나리오가 없습니다. 오른쪽 상단의 시나리오 추가 버튼을 눌러 새 데이터를 입력하세요.';
        emptyRow.appendChild(td);
        scenarioTableBody.appendChild(emptyRow);
        return;
    }

    state.scenarios.forEach((scenario) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${scenario.title || '-'}</td>
            <td>${formatDifficulty(scenario.difficulty)}</td>
            <td>${formatDate(scenario.createdAt || '')}</td>
            <td>${Array.isArray(scenario.missions) ? scenario.missions.length : 0}</td>
            <td class="table-actions"></td>
        `;

        const actionsCell = tr.querySelector('.table-actions');
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'icon-button';
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.setAttribute('aria-label', `${scenario.title || '시나리오'} 수정`);
        editBtn.addEventListener('click', () => openScenarioModal('edit', scenario));

        actionsCell.appendChild(editBtn);
        scenarioTableBody.appendChild(tr);
    });
}

export function openScenarioModal(mode = 'add', scenario = null) {
    state.editingScenarioId = mode === 'edit' ? scenario?.id : null;
    scenarioModalTitle.textContent = mode === 'edit' ? '시나리오 수정' : '시나리오 추가';

    if (mode === 'edit' && scenario) {
        scenarioTitleInput.value = scenario.title || '';
        scenarioDifficultyInput.value = scenario.difficulty || 'easy';
        state.scenarioMissions = Array.isArray(scenario.missions)
            ? scenario.missions.map((mission) => normalizeMission(mission))
            : [];
    } else {
        scenarioForm.reset();
        scenarioDifficultyInput.value = 'easy';
        state.scenarioMissions = [];
    }

    resetMissionForm();
    renderMissionList();
    scenarioModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

export function closeScenarioModal() {
    scenarioModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    scenarioForm.reset();
    state.scenarioMissions = [];
    resetMissionForm();
    renderMissionList();
}

export function addMissionFromInputs() {
    const name = missionNameInput.value.trim();
    const expectedQuestions = getExpectedItems(missionQuestionsList);
    const expectedAnswers = getExpectedItems(missionAnswersList);

    if (!name) {
        showToast('미션 이름을 입력해주세요.', 'error');
        return;
    }

    if (expectedQuestions.length > MAX_EXPECTED_ITEMS || expectedAnswers.length > MAX_EXPECTED_ITEMS) {
        showToast('예상 질문/답변은 각각 최대 3개까지 입력할 수 있습니다.', 'error');
        return;
    }

    const missionPayload = normalizeMission({
        name,
        expectedQuestions,
        expectedAnswers
    });

    if (state.editingMissionIndex !== null) {
        state.scenarioMissions[state.editingMissionIndex] = missionPayload;
        showToast('미션이 업데이트되었습니다.', 'success');
    } else {
        state.scenarioMissions.push(missionPayload);
        showToast('미션이 추가되었습니다.', 'success');
    }

    resetMissionForm();
    renderMissionList();
}

export function renderMissionList() {
    missionList.innerHTML = '';

    if (!state.scenarioMissions.length) {
        const empty = document.createElement('div');
        empty.className = 'chip-empty';
        empty.textContent = '미션을 추가해주세요.';
        missionList.appendChild(empty);
        return;
    }

    state.scenarioMissions.forEach((mission, index) => {
        const card = document.createElement('div');
        card.className = 'mission-card';
        if (state.editingMissionIndex === index) {
            card.classList.add('editing');
        }

        const header = document.createElement('div');
        header.className = 'mission-card-header';

        const title = document.createElement('div');
        title.className = 'mission-title';
        title.textContent = `${index + 1}. ${mission.name}`;

        const actions = document.createElement('div');
        actions.className = 'mission-card-actions';

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'icon-button';
        editBtn.setAttribute('aria-label', `${mission.name} 편집`);
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.addEventListener('click', () => startEditMission(index));

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'icon-button';
        removeBtn.setAttribute('aria-label', `${mission.name} 삭제`);
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.addEventListener('click', () => removeMission(index));

        actions.append(editBtn, removeBtn);
        header.append(title, actions);

        const meta = document.createElement('div');
        meta.className = 'mission-meta';
        meta.innerHTML = `
            <span><i class="fas fa-question-circle"></i> 예상 질문 ${mission.expectedQuestions?.length || 0}개</span>
            <span><i class="fas fa-comment-dots"></i> 예상 답변 ${mission.expectedAnswers?.length || 0}개</span>
        `;

        const details = document.createElement('div');
        details.className = 'mission-details';

        const questionsList = document.createElement('div');
        questionsList.className = 'mission-list-block';
        questionsList.innerHTML = `
            <div class="mission-list-title"><i class="fas fa-question-circle"></i> 예상 질문</div>
            ${renderMissionItems(mission.expectedQuestions, '입력된 예상 질문이 없습니다.')}
        `;

        const answersList = document.createElement('div');
        answersList.className = 'mission-list-block';
        answersList.innerHTML = `
            <div class="mission-list-title"><i class="fas fa-comment-dots"></i> 예상 답변</div>
            ${renderMissionItems(mission.expectedAnswers, '입력된 예상 답변이 없습니다.')}
        `;

        details.append(questionsList, answersList);

        card.append(header, meta, details);
        missionList.appendChild(card);
    });
}

function renderMissionItems(items = [], emptyText) {
    if (!items.length) {
        return `<p class="mission-empty">${emptyText}</p>`;
    }

    const list = items
        .slice(0, MAX_EXPECTED_ITEMS)
        .map((item, idx) => `<li>${idx + 1}. ${item}</li>`) // length already enforced but keep slicing
        .join('');

    return `<ul class="mission-text-list">${list}</ul>`;
}

function startEditMission(index) {
    const mission = state.scenarioMissions[index];
    if (!mission) return;

    state.editingMissionIndex = index;
    missionNameInput.value = mission.name || '';
    renderExpectedInputs(mission.expectedQuestions || [], mission.expectedAnswers || []);
    updateMissionActionState();
    renderMissionList();
}

function removeMission(index) {
    state.scenarioMissions.splice(index, 1);
    resetMissionForm();
    renderMissionList();
}

export async function handleScenarioSubmit(event, onScenariosUpdated) {
    event.preventDefault();
    if (!state.currentUser) return;

    const title = scenarioTitleInput.value.trim();
    const difficulty = scenarioDifficultyInput.value;
    const missions = state.scenarioMissions.map((mission) => normalizeMission(mission));

    if (!title || !difficulty) {
        showToast('제목과 난이도를 입력해주세요.', 'error');
        return;
    }

    if (!missions.length) {
        showToast('최소 1개의 미션을 추가해주세요.', 'error');
        return;
    }

    const payload = {
        adminId: state.currentUser.uid,
        title,
        difficulty,
        missions,
        updatedAt: serverTimestamp()
    };

    try {
        if (state.editingScenarioId) {
            await updateDoc(doc(db, 'scenarios', state.editingScenarioId), payload);
            showToast('시나리오가 수정되었습니다.', 'success');
        } else {
            await addDoc(collection(db, 'scenarios'), {
                ...payload,
                createdAt: serverTimestamp()
            });
            showToast('새 시나리오가 추가되었습니다.', 'success');
        }

        await loadScenarios();
        renderScenarioTable();
        onScenariosUpdated?.();
        closeScenarioModal();
    } catch (error) {
        console.error('Scenario save error:', error);
        showToast(getFirestoreErrorMessage(error), 'error');
    }
}

export function wireScenarioEvents(onScenariosUpdated) {
    addScenarioBtn?.addEventListener('click', () => openScenarioModal('add'));
    closeScenarioModalBtn?.addEventListener('click', closeScenarioModal);
    cancelScenarioBtn?.addEventListener('click', closeScenarioModal);
    scenarioForm?.addEventListener('submit', (event) => handleScenarioSubmit(event, onScenariosUpdated));
    addMissionBtn?.addEventListener('click', addMissionFromInputs);
    addQuestionBtn?.addEventListener('click', () => addExpectedItem('question'));
    addAnswerBtn?.addEventListener('click', () => addExpectedItem('answer'));
    missionNameInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addMissionFromInputs();
        }
    });

    updateMissionActionState();
    renderExpectedInputs();
    renderMissionList();
}
