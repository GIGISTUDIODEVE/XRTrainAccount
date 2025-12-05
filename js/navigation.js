import {
    adminView,
    authContainer,
    dashboardContainer,
    pages,
    participantView,
    tabAdmin,
    tabParticipants,
    tabScenarios,
    participantCountEl,
    scenarioView
} from './domElements.js';
import { state } from './state.js';
import { formatDate } from './utils.js';
import { renderParticipantTable } from './participants.js';
import { syncEditFormWithProfile } from './profile.js';

export function setActivePage(pageKey) {
    Object.entries(pages).forEach(([key, element]) => {
        if (!element) return;
        if (key === pageKey) {
            element.classList.remove('hidden');
        } else {
            element.classList.add('hidden');
        }
    });
}

export function setDashboardTab(tabKey) {
    const tabMap = {
        admin: { tab: tabAdmin, view: adminView },
        participants: { tab: tabParticipants, view: participantView },
        scenarios: { tab: tabScenarios, view: scenarioView }
    };

    Object.entries(tabMap).forEach(([key, { tab, view }]) => {
        const isActive = key === tabKey;
        tab?.classList.toggle('active', isActive);
        view?.classList.toggle('hidden', !isActive);
    });
}

export function updateDashboard(profile) {
    document.getElementById('userDisplayName').textContent = profile.fullName;
    document.getElementById('dashboardFullName').textContent = profile.fullName;
    document.getElementById('dashboardEmail').textContent = profile.email;
    document.getElementById('dashboardAffiliation').textContent = profile.affiliation || '-';
    document.getElementById('dashboardPosition').textContent = profile.position || '-';

    const joinDate = profile.createdAt ? new Date(profile.createdAt) : new Date();
    document.getElementById('dashboardJoinDate').textContent = formatDate(joinDate);
    participantCountEl.textContent = state.participants.length.toString();

    syncEditFormWithProfile();
    renderParticipantTable();
}

export function showDashboard() {
    if (!state.currentUser) return;

    authContainer.classList.add('hidden');
    dashboardContainer.classList.remove('hidden');
    setActivePage('profile');
    setDashboardTab('admin');
    updateDashboard(state.currentUser);
}

export function showAuth() {
    dashboardContainer.classList.add('hidden');
    authContainer.classList.remove('hidden');
    setActivePage('login');
}
