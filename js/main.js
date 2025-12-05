import {
    handleGoogleRedirectResult,
    initAuthListeners,
    wireAuthEvents
} from './authHandlers.js';
import { wireProfileEvents } from './profile.js';
import { loadParticipants, renderParticipantTable, wireParticipantEvents } from './participants.js';
import { setDashboardTab, showDashboard, updateDashboard, showAuth } from './navigation.js';
import { state } from './state.js';

window.addEventListener('DOMContentLoaded', () => {
    handleGoogleRedirectResult();
    setupEventListeners();
    initAuthListeners(() => {
        if (state.currentUser) {
            renderParticipantTable();
            showDashboard();
        } else {
            showAuth();
        }
    });
});

function setupEventListeners() {
    wireAuthEvents();
    wireProfileEvents(updateDashboard);
    wireParticipantEvents(async () => {
        await loadParticipants();
        updateDashboard(state.currentUser);
    });

    document.getElementById('tabAdmin')?.addEventListener('click', () => setDashboardTab('admin'));
    document.getElementById('tabParticipants')?.addEventListener('click', () => setDashboardTab('participants'));
}
