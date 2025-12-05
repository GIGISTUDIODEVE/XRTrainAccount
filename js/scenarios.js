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
    missionAnswersInput,
    missionList,
    missionNameInput,
    missionQuestionsInput,
    scenarioDifficultyInput,
    scenarioForm,
    scenarioModal,
    scenarioModalTitle,
    scenarioTableBody,
    scenarioTitleInput
} from './domElements.js';
import { state } from './state.js';
import { formatDate, getFirestoreErrorMessage, isFirestorePermissionError, showToast } from './utils.js';

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
        state.scenarioMissions = Array.isArray(scenario.missions) ? [...scenario.missions] : [];
    } else {
        scenarioForm.reset();
        scenarioDifficultyInput.value = 'easy';
        state.scenarioMissions = [];
    }

    renderMissionList();
    scenarioModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

export function closeScenarioModal() {
    scenarioModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    scenarioForm.reset();
    state.scenarioMissions = [];
    renderMissionList();
}

export function addMissionFromInputs() {
    const name = missionNameInput.value.trim();
    const expectedQuestions = missionQuestionsInput.value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
    const expectedAnswers = missionAnswersInput.value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);

    if (!name) {
        showToast('미션 이름을 입력해주세요.', 'error');
        return;
    }

    state.scenarioMissions.push({
        name,
        expectedQuestions,
        expectedAnswers
    });

    missionNameInput.value = '';
    missionQuestionsInput.value = '';
    missionAnswersInput.value = '';
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

        const header = document.createElement('div');
        header.className = 'mission-card-header';

        const title = document.createElement('div');
        title.className = 'mission-title';
        title.textContent = `${index + 1}. ${mission.name}`;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'icon-button';
        removeBtn.setAttribute('aria-label', `${mission.name} 삭제`);
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.addEventListener('click', () => removeMission(index));

        header.append(title, removeBtn);

        const meta = document.createElement('div');
        meta.className = 'mission-meta';
        meta.innerHTML = `
            <span><i class="fas fa-question-circle"></i> 예상 질문 ${mission.expectedQuestions?.length || 0}개</span>
            <span><i class="fas fa-comment-dots"></i> 예상 답변 ${mission.expectedAnswers?.length || 0}개</span>
        `;

        card.append(header, meta);
        missionList.appendChild(card);
    });
}

function removeMission(index) {
    state.scenarioMissions.splice(index, 1);
    renderMissionList();
}

export async function handleScenarioSubmit(event, onScenariosUpdated) {
    event.preventDefault();
    if (!state.currentUser) return;

    const title = scenarioTitleInput.value.trim();
    const difficulty = scenarioDifficultyInput.value;
    const missions = [...state.scenarioMissions];

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

function formatDifficulty(value) {
    switch (value) {
        case 'medium':
            return '보통';
        case 'hard':
            return '어려움';
        case 'easy':
        default:
            return '쉬움';
    }
}

export function wireScenarioEvents(onScenariosUpdated) {
    addScenarioBtn?.addEventListener('click', () => openScenarioModal('add'));
    closeScenarioModalBtn?.addEventListener('click', closeScenarioModal);
    cancelScenarioBtn?.addEventListener('click', closeScenarioModal);
    scenarioForm?.addEventListener('submit', (event) => handleScenarioSubmit(event, onScenariosUpdated));
    addMissionBtn?.addEventListener('click', addMissionFromInputs);
    missionNameInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addMissionFromInputs();
        }
    });

    renderMissionList();
}
