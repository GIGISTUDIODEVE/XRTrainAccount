import {
    handleGoogleRedirectResult,
    initAuthListeners,
    wireAuthEvents
} from './authHandlers.js';
import { wireProfileEvents } from './profile.js';
import { loadParticipants, renderParticipantTable, wireParticipantEvents } from './participants.js';
import { loadScenarios, renderScenarioTable, wireScenarioEvents } from './scenarios.js';
import { loadContents, renderContentTable, wireContentEvents } from './contents.js';
import { setDashboardTab, showDashboard, updateDashboard, showAuth } from './navigation.js';
import { state } from './state.js';

window.addEventListener('DOMContentLoaded', () => {
    handleGoogleRedirectResult();
    setupEventListeners();
    initAuthListeners(() => {
        if (state.currentUser) {
            renderParticipantTable();
            renderScenarioTable();
            renderContentTable();
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

    wireScenarioEvents(async () => {
        await loadScenarios();
        renderScenarioTable();
    });

    wireContentEvents(async () => {
        await loadContents();
        renderContentTable();
    });

    document.getElementById('tabAdmin')?.addEventListener('click', () => setDashboardTab('admin'));
    document.getElementById('tabParticipants')?.addEventListener('click', () => setDashboardTab('participants'));
    document.getElementById('tabScenarios')?.addEventListener('click', () => setDashboardTab('scenarios'));
    document.getElementById('tabContents')?.addEventListener('click', () => setDashboardTab('contents'));
}
