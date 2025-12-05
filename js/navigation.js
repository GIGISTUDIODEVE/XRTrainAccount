import {
    adminView,
    authContainer,
    dashboardContainer,
    pages,
    participantView,
    tabAdmin,
    tabParticipants,
    participantCountEl
} from './domElements.js';
import { state } from './state.js';
import { formatConditions, formatDate, formatGender, formatStatus } from './utils.js';
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
    if (!adminView || !participantView) return;

    const isAdmin = tabKey === 'admin';
    tabAdmin?.classList.toggle('active', isAdmin);
    tabParticipants?.classList.toggle('active', !isAdmin);
    adminView.classList.toggle('hidden', !isAdmin);
    participantView.classList.toggle('hidden', isAdmin);
}

export function updateDashboard(profile) {
    document.getElementById('userDisplayName').textContent = profile.fullName;
    document.getElementById('dashboardFullName').textContent = profile.fullName;
    document.getElementById('dashboardUsername').textContent = profile.username;
    document.getElementById('dashboardEmail').textContent = profile.email;

    const joinDate = profile.createdAt ? new Date(profile.createdAt) : new Date();
    document.getElementById('dashboardJoinDate').textContent = formatDate(joinDate);
    document.getElementById('dashboardBirthDate').textContent = profile.birthDate || '-';
    document.getElementById('dashboardAge').textContent = profile.age ?? '-';
    document.getElementById('dashboardGender').textContent = formatGender(profile.gender);
    document.getElementById('dashboardRegion').textContent = profile.region || '-';
    document.getElementById('dashboardConditions').textContent = formatConditions(profile.conditions);
    document.getElementById('dashboardStatus').textContent = formatStatus(profile.status);
    document.getElementById('dashboardNotes').textContent = profile.notes || '-';
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
