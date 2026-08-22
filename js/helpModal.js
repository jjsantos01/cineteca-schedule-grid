/**
 * helpModal.js - Modal de Ayuda con documentación completa y disparador del Tour
 */

import { startTour } from './tour.js';

let isModalOpen = false;

export function initHelpModal() {
    const helpBtn = document.getElementById('helpBtn');
    const helpModal = document.getElementById('helpModal');
    const closeBtn = document.getElementById('helpModalClose');
    const startTourBtn = document.getElementById('startTourFromModalBtn');

    if (helpBtn) {
        helpBtn.addEventListener('click', openHelpModal);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeHelpModal);
    }

    if (startTourBtn) {
        startTourBtn.addEventListener('click', () => {
            closeHelpModal();
            // Start onboarding tour
            setTimeout(() => {
                startTour({
                    onComplete: () => {
                        // Optional callback
                    }
                });
            }, 100);
        });
    }

    if (helpModal) {
        helpModal.addEventListener('click', (event) => {
            if (event.target === helpModal) {
                closeHelpModal();
            }
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isModalOpen) {
            closeHelpModal();
        } else if ((event.key === '?' || event.key === 'F1') && !isModalOpen && !isInputFocused()) {
            event.preventDefault();
            openHelpModal();
        }
    });
}

function isInputFocused() {
    const active = document.activeElement;
    return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
}

export function openHelpModal() {
    const helpModal = document.getElementById('helpModal');
    if (!helpModal) return;

    helpModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    isModalOpen = true;

    // Focus close button or tour button for accessibility
    const startTourBtn = document.getElementById('startTourFromModalBtn');
    if (startTourBtn) {
        startTourBtn.focus();
    }
}

export function closeHelpModal() {
    const helpModal = document.getElementById('helpModal');
    if (!helpModal) return;

    helpModal.style.display = 'none';
    document.body.style.overflow = '';
    isModalOpen = false;
}

export function isHelpModalOpen() {
    return isModalOpen;
}
