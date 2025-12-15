// ===== DOM Elements =====
const serviceSelect = document.getElementById('service');
const customEndpointGroup = document.getElementById('customEndpointGroup');
const customEndpointInput = document.getElementById('customEndpoint');
const apiKeyInput = document.getElementById('apiKey');
const toggleApiKeyBtn = document.getElementById('toggleApiKey');
const sourceLangSelect = document.getElementById('sourceLang');
const targetLangSelect = document.getElementById('targetLang');
const swapLangBtn = document.getElementById('swapLang');
const smartTranslateToggle = document.getElementById('smartTranslate');
const saveBtn = document.getElementById('saveBtn');
const statusMessage = document.getElementById('statusMessage');

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', loadSettings);

// ===== Event Listeners =====
serviceSelect.addEventListener('change', handleServiceChange);
toggleApiKeyBtn.addEventListener('click', toggleApiKeyVisibility);
swapLangBtn.addEventListener('click', swapLanguages);
saveBtn.addEventListener('click', saveSettings);

// ===== Functions =====

/**
 * Load settings from chrome storage
 */
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get([
      'service',
      'customEndpoint',
      'apiKey',
      'sourceLang',
      'targetLang',
      'smartTranslate'
    ]);

    if (result.service) {
      serviceSelect.value = result.service;
      handleServiceChange();
    }

    if (result.customEndpoint) {
      customEndpointInput.value = result.customEndpoint;
    }

    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }

    if (result.sourceLang) {
      sourceLangSelect.value = result.sourceLang;
    }

    if (result.targetLang) {
      targetLangSelect.value = result.targetLang;
    }

    if (result.smartTranslate !== undefined) {
      smartTranslateToggle.checked = result.smartTranslate;
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

/**
 * Handle service selection change
 */
function handleServiceChange() {
  const isCustom = serviceSelect.value === 'custom';
  customEndpointGroup.classList.toggle('hidden', !isCustom);
}

/**
 * Toggle API key visibility
 */
function toggleApiKeyVisibility() {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  toggleApiKeyBtn.title = isPassword ? 'Hide API Key' : 'Show API Key';
}

/**
 * Swap source and target languages
 */
function swapLanguages() {
  // Don't swap if source is auto-detect
  if (sourceLangSelect.value === 'auto') {
    showStatus('Cannot swap when source is Auto Detect', 'error');
    return;
  }

  const temp = sourceLangSelect.value;
  sourceLangSelect.value = targetLangSelect.value;
  targetLangSelect.value = temp;

  // Add animation effect
  swapLangBtn.style.transform = 'rotate(180deg)';
  setTimeout(() => {
    swapLangBtn.style.transform = '';
  }, 300);
}

/**
 * Save settings to chrome storage
 */
async function saveSettings() {
  const service = serviceSelect.value;
  const customEndpoint = customEndpointInput.value.trim();
  const apiKey = apiKeyInput.value.trim();
  const sourceLang = sourceLangSelect.value;
  const targetLang = targetLangSelect.value;
  const smartTranslate = smartTranslateToggle.checked;

  // Validation
  if (!apiKey) {
    showStatus('Please enter your API key', 'error');
    return;
  }

  if (service === 'custom' && !customEndpoint) {
    showStatus('Please enter custom API endpoint', 'error');
    return;
  }

  if (sourceLang !== 'auto' && sourceLang === targetLang) {
    showStatus('Source and target languages cannot be the same', 'error');
    return;
  }

  try {
    await chrome.storage.sync.set({
      service,
      customEndpoint,
      apiKey,
      sourceLang,
      targetLang,
      smartTranslate
    });

    showStatus('Settings saved successfully! ✓', 'success');

    // Notify content scripts about the settings change
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'SETTINGS_UPDATED' }).catch(() => {
        // Ignore errors if content script is not loaded
      });
    }
  } catch (error) {
    console.error('Failed to save settings:', error);
    showStatus('Failed to save settings', 'error');
  }
}

/**
 * Show status message
 */
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;

  // Hide after 3 seconds
  setTimeout(() => {
    statusMessage.classList.add('hidden');
  }, 3000);
}
