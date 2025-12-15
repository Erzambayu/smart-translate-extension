/**
 * AI Translator - Content Script
 * Handles text selection, popup display, and translation requests
 */

(function () {
    'use strict';

    // ===== State =====
    let popup = null;
    let modalOverlay = null;
    let settings = null;
    let isProcessing = false;
    let lastSelectedText = '';
    let currentTextBox = null;
    let translationTimer = null; // Timer untuk delay terjemahan

    // ===== Config =====
    const TRANSLATION_DELAY_MS = 500; // Delay sebelum terjemahan dimulai (dalam milidetik)

    // ===== Initialize =====
    init();

    async function init() {
        await loadSettings();
        setupEventListeners();
        listenForMessages();
    }

    // ===== Settings =====
    async function loadSettings() {
        try {
            settings = await chrome.storage.sync.get([
                'service',
                'customEndpoint',
                'apiKey',
                'sourceLang',
                'targetLang',
                'smartTranslate'
            ]);
        } catch (error) {
            console.error('AI Translator: Failed to load settings', error);
            settings = {};
        }
    }

    function listenForMessages() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'SETTINGS_UPDATED') {
                loadSettings();
            }
        });
    }

    // ===== Event Listeners =====
    function setupEventListeners() {
        // Use passive listeners to not block other extensions or page functionality
        // We listen on capture: false (default) to let other handlers process first
        document.addEventListener('mouseup', handleMouseUp, { passive: true });
        document.addEventListener('mousedown', handleMouseDown, { passive: true });
        document.addEventListener('keydown', handleKeyDown, { passive: true });
    }

    // Check if element is from another extension or special element
    function isExternalElement(element) {
        if (!element) return false;

        // Check for common extension patterns
        const tagName = element.tagName?.toLowerCase() || '';

        // Shadow DOM hosts from other extensions
        if (element.shadowRoot) return true;

        // Elements with extension-specific attributes
        if (element.closest('[data-extension-id]')) return true;
        if (element.closest('[class*="extension"]')) return true;

        // WhatsApp Web specific elements
        if (element.closest('[data-app="web"]')) return true;
        if (element.closest('#app')) {
            // Check if it's actually WhatsApp
            if (window.location.hostname.includes('whatsapp')) return true;
        }

        return false;
    }

    function handleMouseDown(e) {
        // Cancel pending translation timer
        if (translationTimer) {
            clearTimeout(translationTimer);
            translationTimer = null;
        }

        // Close popup if clicking outside
        if (popup && !popup.contains(e.target)) {
            removePopup();
        }
    }

    function handleKeyDown(e) {
        // Cancel pending translation timer on Escape
        if (e.key === 'Escape') {
            if (translationTimer) {
                clearTimeout(translationTimer);
                translationTimer = null;
            }
            removePopup();
            removeModal();
        }
    }

    async function handleMouseUp(e) {
        // Ignore if processing or no API key
        if (isProcessing || !settings?.apiKey) return;

        // Don't interfere with other extensions or special pages
        if (isExternalElement(e.target)) return;

        // Cancel previous timer if still running
        if (translationTimer) {
            clearTimeout(translationTimer);
            translationTimer = null;
        }

        // Small delay to ensure selection is complete
        await new Promise(resolve => setTimeout(resolve, 10));

        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        // Ignore empty or very short selections
        if (!selectedText || selectedText.length < 2) return;

        // Ignore if same text already shown
        if (selectedText === lastSelectedText && popup) return;

        // Check if selection is in a text input
        const activeElement = document.activeElement;
        const isInTextBox = isTextInputElement(activeElement);

        // Store data for delayed processing
        const selectionData = {
            text: selectedText,
            isInTextBox: isInTextBox,
            activeElement: activeElement,
            range: !isInTextBox ? selection.getRangeAt(0).getBoundingClientRect() : null
        };

        // Start delayed translation with debounce
        translationTimer = setTimeout(async () => {
            translationTimer = null;

            // Re-check if selection still exists
            const currentSelection = window.getSelection();
            const currentText = currentSelection.toString().trim();

            // Only proceed if selection is still the same
            if (currentText !== selectionData.text) return;

            lastSelectedText = selectionData.text;

            if (selectionData.isInTextBox) {
                // Text box mode - show confirmation modal
                currentTextBox = selectionData.activeElement;
                await handleTextBoxSelection(selectionData.text);
            } else {
                // Regular text mode - show translation popup
                await showTranslationPopup(selectionData.text, selectionData.range);
            }
        }, TRANSLATION_DELAY_MS);
    }

    // ===== Text Box Detection =====
    function isTextInputElement(element) {
        if (!element) return false;

        const tagName = element.tagName.toLowerCase();

        // Check for input or textarea
        if (tagName === 'textarea') return true;
        if (tagName === 'input') {
            const type = element.type.toLowerCase();
            return ['text', 'search', 'url', 'email', 'tel'].includes(type);
        }

        // Check for contenteditable
        return element.isContentEditable;
    }

    // ===== Translation Popup =====
    async function showTranslationPopup(text, rect) {
        removePopup();

        // Detect dark mode on page
        const isDark = isDarkMode();

        // Create popup element
        popup = document.createElement('div');
        popup.className = `ai-translator-popup${isDark ? ' dark' : ''}`;

        // Show loading state first
        popup.innerHTML = createPopupContent({
            loading: true,
            sourceLang: settings.sourceLang || 'auto',
            targetLang: settings.targetLang || 'id'
        });

        // Temporarily add to DOM to measure size
        popup.style.visibility = 'hidden';
        popup.style.position = 'absolute';
        document.body.appendChild(popup);

        // Get popup dimensions
        const popupRect = popup.getBoundingClientRect();
        const popupHeight = popupRect.height || 80; // Default height if not measurable
        const popupWidth = popupRect.width || 300;

        // Calculate available space
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceLeft = rect.left;
        const spaceRight = window.innerWidth - rect.right;

        // Determine vertical position (above or below)
        let positionBelow = false;
        let popupY;

        if (spaceAbove >= popupHeight + 15) {
            // Enough space above - position above the selection
            popupY = rect.top + window.scrollY - 10;
            popup.style.transform = 'translateY(-100%)';
            popup.classList.remove('arrow-top');
        } else if (spaceBelow >= popupHeight + 15) {
            // Not enough space above, position below
            popupY = rect.bottom + window.scrollY + 10;
            popup.style.transform = 'translateY(0)';
            popup.classList.add('arrow-top');
            positionBelow = true;
        } else {
            // No good space, default to above but constrain
            popupY = Math.max(popupHeight + 10 + window.scrollY, rect.top + window.scrollY - 10);
            popup.style.transform = 'translateY(-100%)';
        }

        // Determine horizontal position
        let popupX = rect.left + window.scrollX;

        // Check right edge
        if (popupX + popupWidth > window.innerWidth - 10 + window.scrollX) {
            popupX = window.innerWidth - popupWidth - 10 + window.scrollX;
            popup.classList.add('arrow-right');
        }

        // Check left edge
        if (popupX < 10) {
            popupX = 10;
            popup.classList.remove('arrow-right');
        }

        // Apply final position
        popup.style.left = `${popupX}px`;
        popup.style.top = `${popupY}px`;
        popup.style.visibility = 'visible';

        // Request translation
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'TRANSLATE',
                text: text,
                sourceLang: settings.sourceLang || 'auto',
                targetLang: settings.targetLang || 'id'
            });

            if (!popup) return; // Popup was closed

            // Check if response is valid
            if (!response) {
                popup.innerHTML = createPopupContent({
                    error: 'No response from extension. Please reload the page.',
                    sourceLang: settings.sourceLang || 'auto',
                    targetLang: settings.targetLang || 'id'
                });
                return;
            }

            if (response.success) {
                popup.innerHTML = createPopupContent({
                    translation: response.translation,
                    sourceLang: response.detectedLang || settings.sourceLang,
                    targetLang: settings.targetLang || 'id'
                });
                setupPopupEvents();
            } else {
                popup.innerHTML = createPopupContent({
                    error: response.error || 'Translation failed',
                    sourceLang: settings.sourceLang || 'auto',
                    targetLang: settings.targetLang || 'id'
                });
            }
        } catch (error) {
            console.error('AI Translator: Translation error', error);
            if (!popup) return;

            // More descriptive error messages
            let errorMessage = 'Connection error';
            if (error?.message?.includes('Extension context invalidated')) {
                errorMessage = 'Extension reloaded. Please refresh the page.';
            } else if (error?.message?.includes('Could not establish connection')) {
                errorMessage = 'Extension not responding. Try reloading the page.';
            } else if (error?.message) {
                errorMessage = error.message;
            }

            popup.innerHTML = createPopupContent({
                error: errorMessage,
                sourceLang: settings.sourceLang || 'auto',
                targetLang: settings.targetLang || 'id'
            });
        }
    }

    function createPopupContent({ loading, translation, error, sourceLang, targetLang }) {
        const langNames = {
            'auto': 'Auto',
            'en': 'EN',
            'id': 'ID',
            'ja': 'JA',
            'ko': 'KO',
            'zh': 'ZH',
            'es': 'ES',
            'fr': 'FR',
            'de': 'DE',
            'pt': 'PT',
            'ru': 'RU',
            'ar': 'AR',
            'hi': 'HI',
            'th': 'TH',
            'vi': 'VI',
            'nl': 'NL',
            'pl': 'PL',
            'tr': 'TR',
            'it': 'IT'
        };

        const headerHtml = `
      <div class="ait-header">
        <div class="ait-lang-info">
          <span>${langNames[sourceLang] || sourceLang}</span>
          <span class="ait-lang-arrow">→</span>
          <span>${langNames[targetLang] || targetLang}</span>
        </div>
        <button class="ait-close-btn" title="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `;

        let contentHtml = '';

        if (loading) {
            contentHtml = `
        <div class="ait-content">
          <div class="ait-loading">
            <div class="ait-spinner"></div>
            <span>Translating...</span>
          </div>
        </div>
      `;
        } else if (error) {
            contentHtml = `
        <div class="ait-content">
          <div class="ait-error">
            <span class="ait-error-icon">⚠️</span>
            <span>${escapeHtml(error)}</span>
          </div>
        </div>
      `;
        } else {
            contentHtml = `
        <div class="ait-content">
          <div class="ait-translation">${escapeHtml(translation)}</div>
        </div>
        <div class="ait-footer">
          <button class="ait-copy-btn" title="Copy translation">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy
          </button>
        </div>
      `;
        }

        return headerHtml + contentHtml;
    }

    function setupPopupEvents() {
        if (!popup) return;

        const closeBtn = popup.querySelector('.ait-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', removePopup);
        }

        const copyBtn = popup.querySelector('.ait-copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const translation = popup.querySelector('.ait-translation')?.textContent;
                if (translation) {
                    navigator.clipboard.writeText(translation);
                    copyBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Copied!
          `;
                    setTimeout(() => {
                        if (copyBtn) {
                            copyBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy
              `;
                        }
                    }, 1500);
                }
            });
        }
    }

    function removePopup() {
        if (popup) {
            popup.remove();
            popup = null;
            lastSelectedText = '';
        }
    }

    // ===== Text Box Translation (with Modal) =====
    async function handleTextBoxSelection(text) {
        removeModal();

        isProcessing = true;

        // First get the translation
        let translation = '';
        let error = '';

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'TRANSLATE',
                text: text,
                sourceLang: settings.sourceLang || 'auto',
                targetLang: settings.targetLang || 'id'
            });

            if (!response) {
                error = 'No response from extension. Please reload the page.';
            } else if (response.success) {
                translation = response.translation;
            } else {
                error = response.error || 'Translation failed';
            }
        } catch (err) {
            console.error('AI Translator: TextBox translation error', err);
            if (err?.message?.includes('Extension context invalidated')) {
                error = 'Extension reloaded. Please refresh the page.';
            } else if (err?.message?.includes('Could not establish connection')) {
                error = 'Extension not responding. Try reloading the page.';
            } else {
                error = err?.message || 'Connection error';
            }
        }

        isProcessing = false;

        if (error) {
            // Show error briefly then close
            showToast(error, 'error');
            return;
        }

        // Show confirmation modal
        showConfirmationModal(text, translation);
    }

    function showConfirmationModal(originalText, translation) {
        const isDark = isDarkMode();

        modalOverlay = document.createElement('div');
        modalOverlay.className = 'ai-translator-modal-overlay';

        const modal = document.createElement('div');
        modal.className = `ai-translator-modal${isDark ? ' dark' : ''}`;

        modal.innerHTML = `
      <div class="ait-modal-header">
        <div class="ait-modal-icon">🌐</div>
        <h3 class="ait-modal-title">Replace with Translation?</h3>
      </div>
      <div class="ait-modal-body">
        <div class="ait-modal-label">Original Text</div>
        <div class="ait-modal-text">${escapeHtml(originalText)}</div>
        <div class="ait-modal-label">Translation</div>
        <div class="ait-modal-text translation">${escapeHtml(translation)}</div>
      </div>
      <div class="ait-modal-footer">
        <button class="ait-modal-btn cancel">Cancel</button>
        <button class="ait-modal-btn confirm">Replace</button>
      </div>
    `;

        modalOverlay.appendChild(modal);
        document.body.appendChild(modalOverlay);

        // Event listeners
        const cancelBtn = modal.querySelector('.ait-modal-btn.cancel');
        const confirmBtn = modal.querySelector('.ait-modal-btn.confirm');

        cancelBtn.addEventListener('click', removeModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) removeModal();
        });

        confirmBtn.addEventListener('click', () => {
            replaceTextInTextBox(translation);
            removeModal();
        });
    }

    function replaceTextInTextBox(translation) {
        if (!currentTextBox) return;

        const element = currentTextBox;

        if (element.isContentEditable) {
            // ContentEditable element
            document.execCommand('insertText', false, translation);
        } else {
            // Input or textarea
            const start = element.selectionStart;
            const end = element.selectionEnd;
            const value = element.value;

            element.value = value.substring(0, start) + translation + value.substring(end);

            // Set cursor after inserted text
            const newPos = start + translation.length;
            element.setSelectionRange(newPos, newPos);

            // Trigger input event for frameworks
            element.dispatchEvent(new Event('input', { bubbles: true }));
        }

        currentTextBox = null;
    }

    function removeModal() {
        if (modalOverlay) {
            modalOverlay.remove();
            modalOverlay = null;
        }
        currentTextBox = null;
    }

    // ===== Toast Notification =====
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'error' ? '#ef4444' : '#1e293b'};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      animation: slideUp 0.3s ease;
    `;
        toast.textContent = message;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ===== Utility Functions =====
    function isDarkMode() {
        // Check for common dark mode indicators
        const bg = window.getComputedStyle(document.body).backgroundColor;
        const rgb = bg.match(/\d+/g);
        if (rgb) {
            const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
            return brightness < 128;
        }
        return false;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
})();
