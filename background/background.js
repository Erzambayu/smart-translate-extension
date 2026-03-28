/**
 * AI Translator - Background Service Worker
 * Handles translation API requests for various providers
 */

// ===== Translation Cache =====
const translationCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get cached translation if available and not expired
 */
function getCachedTranslation(text, sourceLang, targetLang, service) {
    const key = `${service}:${sourceLang}:${targetLang}:${text}`;
    const cached = translationCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        console.log('Cache hit for:', key.substring(0, 50) + '...');
        return cached;
    }
    return null;
}

/**
 * Store translation in cache
 */
function setCachedTranslation(text, sourceLang, targetLang, service, result) {
    const key = `${service}:${sourceLang}:${targetLang}:${text}`;
    translationCache.set(key, {
        ...result,
        timestamp: Date.now()
    });
    // Clean up old cache entries periodically
    if (translationCache.size > 1000) {
        const oldestKey = Array.from(translationCache.keys())[0];
        translationCache.delete(oldestKey);
    }
}

/**
 * Clear all cache (useful for debugging or user-triggered reset)
 */
function clearCache() {
    translationCache.clear();
    console.log('Translation cache cleared');
}

// ===== Retry Logic with Exponential Backoff =====
async function fetchWithRetry(url, options, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            
            // Don't retry on client errors (4xx)
            if (response.status >= 400 && response.status < 500) {
                return response;
            }
            
            // Retry on server errors (5xx) or network issues
            if (response.ok || attempt === maxRetries - 1) {
                return response;
            }
            
            console.warn(`Attempt ${attempt + 1} failed, retrying...`);
        } catch (error) {
            console.error(`Attempt ${attempt + 1} error:`, error);
            
            // Last attempt failed, throw error
            if (attempt === maxRetries - 1) {
                throw error;
            }
        }
        
        // Exponential backoff: 1s, 2s, 4s, etc.
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    throw new Error('Max retries exceeded');
}

// ===== Message Listener =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TRANSLATE') {
        handleTranslation(message)
            .then(result => {
                console.log('Translation result:', result);
                sendResponse(result);
            })
            .catch(error => {
                console.error('Translation handler error:', error);
                sendResponse({
                    success: false,
                    error: error?.message || 'Unknown error occurred'
                });
            });
        return true; // Keep channel open for async response
    }
    
    if (message.type === 'TEST_CONNECTION') {
        testConnection(message)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({
                success: false,
                error: error?.message || 'Connection test failed'
            }));
        return true;
    }
    
    if (message.type === 'CLEAR_CACHE') {
        clearCache();
        sendResponse({ success: true });
    }
});

// ===== Translation Handler =====
async function handleTranslation({ text, sourceLang, targetLang }) {
    try {
        const settings = await chrome.storage.sync.get([
            'service',
            'customEndpoint',
            'apiKey',
            'smartTranslate'
        ]);

        console.log('Translation settings:', {
            service: settings.service,
            hasApiKey: !!settings.apiKey,
            sourceLang,
            targetLang
        });

        if (!settings.apiKey) {
            return { success: false, error: 'API key not configured. Please set it in extension settings.' };
        }

        const service = settings.service || 'openai';

        // Check cache first
        const cached = getCachedTranslation(text, sourceLang, targetLang, service);
        if (cached) {
            return { success: true, translation: cached.translation, detectedLang: cached.detectedLang, cached: true };
        }

        let result;

        switch (service) {
            case 'openai':
                result = await translateWithOpenAI(text, sourceLang, targetLang, settings.apiKey);
                break;
            case 'gemini':
                result = await translateWithGemini(text, sourceLang, targetLang, settings.apiKey);
                break;
            case 'deepseek':
                result = await translateWithDeepSeek(text, sourceLang, targetLang, settings.apiKey);
                break;
            case 'deepl':
                result = await translateWithDeepL(text, sourceLang, targetLang, settings.apiKey);
                break;
            case 'custom':
                result = await translateWithCustom(text, sourceLang, targetLang, settings.apiKey, settings.customEndpoint);
                break;
            default:
                return { success: false, error: `Unknown service: ${service}` };
        }

        if (!result || !result.translation) {
            return { success: false, error: 'Empty translation received' };
        }

        // Cache the result
        setCachedTranslation(text, sourceLang, targetLang, service, result);

        return { success: true, translation: result.translation, detectedLang: result.detectedLang };
    } catch (error) {
        console.error('Translation error:', error);
        return { success: false, error: error?.message || 'Translation failed' };
    }
}

// ===== Language Helpers =====
const languageNames = {
    'auto': 'auto-detect',
    'en': 'English',
    'id': 'Indonesian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'th': 'Thai',
    'vi': 'Vietnamese',
    'nl': 'Dutch',
    'pl': 'Polish',
    'tr': 'Turkish',
    'it': 'Italian'
};

function getLanguageName(code) {
    return languageNames[code] || code;
}

// ===== OpenAI (ChatGPT) =====
async function translateWithOpenAI(text, sourceLang, targetLang, apiKey) {
    const sourceStr = sourceLang === 'auto' ? 'the source language (auto-detect it)' : getLanguageName(sourceLang);
    const targetStr = getLanguageName(targetLang);

    const response = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `You are a translator. Translate the given text from ${sourceStr} to ${targetStr}. Only respond with the translation, nothing else. Preserve the original formatting and line breaks.`
                },
                {
                    role: 'user',
                    content: text
                }
            ],
            temperature: 0.3,
            max_tokens: 2000
        })
    }, 3, 1000);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return {
        translation: data.choices[0]?.message?.content?.trim() || '',
        detectedLang: sourceLang
    };
}

// ===== Google Gemini =====
async function translateWithGemini(text, sourceLang, targetLang, apiKey) {
    const sourceStr = sourceLang === 'auto' ? 'the source language (auto-detect it)' : getLanguageName(sourceLang);
    const targetStr = getLanguageName(targetLang);

    const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: `Translate the following text from ${sourceStr} to ${targetStr}. Only respond with the translation, nothing else. Preserve the original formatting and line breaks.\n\nText to translate:\n${text}`
                }]
            }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 2000
            }
        })
    }, 3, 1000);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const translation = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    return {
        translation,
        detectedLang: sourceLang
    };
}

// ===== DeepSeek =====
async function translateWithDeepSeek(text, sourceLang, targetLang, apiKey) {
    const sourceStr = sourceLang === 'auto' ? 'the source language (auto-detect it)' : getLanguageName(sourceLang);
    const targetStr = getLanguageName(targetLang);

    const response = await fetchWithRetry('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                {
                    role: 'system',
                    content: `You are a translator. Translate the given text from ${sourceStr} to ${targetStr}. Only respond with the translation, nothing else. Preserve the original formatting and line breaks.`
                },
                {
                    role: 'user',
                    content: text
                }
            ],
            temperature: 0.3,
            max_tokens: 2000
        })
    }, 3, 1000);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    return {
        translation: data.choices[0]?.message?.content?.trim() || '',
        detectedLang: sourceLang
    };
}

// ===== DeepL =====
async function translateWithDeepL(text, sourceLang, targetLang, apiKey) {
    // DeepL uses different language codes
    const deeplSourceLang = sourceLang === 'auto' ? null : sourceLang.toUpperCase();
    const deeplTargetLang = targetLang.toUpperCase();

    // Try free API first, then pro
    const baseUrls = [
        'https://api-free.deepl.com/v2/translate',
        'https://api.deepl.com/v2/translate'
    ];

    let lastError = null;

    for (const baseUrl of baseUrls) {
        try {
            const params = new URLSearchParams({
                text: text,
                target_lang: deeplTargetLang
            });

            if (deeplSourceLang) {
                params.append('source_lang', deeplSourceLang);
            }

            const response = await fetchWithRetry(baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `DeepL-Auth-Key ${apiKey}`
                },
                body: params.toString()
            }, 3, 1000);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                lastError = new Error(errorData.message || `DeepL API error: ${response.status}`);
                continue;
            }

            const data = await response.json();
            return {
                translation: data.translations?.[0]?.text || '',
                detectedLang: data.translations?.[0]?.detected_source_language?.toLowerCase() || sourceLang
            };
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('DeepL translation failed');
}

// ===== Custom API =====
async function translateWithCustom(text, sourceLang, targetLang, apiKey, endpoint) {
    if (!endpoint) {
        throw new Error('Custom API endpoint not configured');
    }

    // Generic request format - adjust based on common API patterns
    const response = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            text: text,
            source_lang: sourceLang,
            target_lang: targetLang,
            // Also include common alternative formats
            q: text,
            source: sourceLang,
            target: targetLang
        })
    }, 3, 1000);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Custom API error: ${response.status} - ${errorText.substring(0, 100)}`);
    }

    const data = await response.json();

    // Try to extract translation from common response formats
    const translation =
        data.translation ||
        data.translatedText ||
        data.translated_text ||
        data.result ||
        data.text ||
        data.data?.translation ||
        data.choices?.[0]?.message?.content ||
        '';

    return {
        translation: translation.trim(),
        detectedLang: data.detected_lang || data.detectedLanguage || sourceLang
    };
}

// ===== Connection Test =====
/**
 * Test API connection with a simple translation
 */
async function testConnection({ service, apiKey, customEndpoint }) {
    try {
        const testText = 'Hello';
        const testSourceLang = 'en';
        const testTargetLang = 'id';

        let result;

        switch (service) {
            case 'openai':
                result = await translateWithOpenAI(testText, testSourceLang, testTargetLang, apiKey);
                break;
            case 'gemini':
                result = await translateWithGemini(testText, testSourceLang, testTargetLang, apiKey);
                break;
            case 'deepseek':
                result = await translateWithDeepSeek(testText, testSourceLang, testTargetLang, apiKey);
                break;
            case 'deepl':
                result = await translateWithDeepL(testText, testSourceLang, testTargetLang, apiKey);
                break;
            case 'custom':
                if (!customEndpoint) {
                    throw new Error('Custom endpoint not configured');
                }
                result = await translateWithCustom(testText, testSourceLang, testTargetLang, apiKey, customEndpoint);
                break;
            default:
                return { success: false, error: `Unknown service: ${service}` };
        }

        if (!result || !result.translation) {
            return { success: false, error: 'Empty translation received' };
        }

        return {
            success: true,
            message: 'Connection successful!',
            sampleTranslation: result.translation
        };
    } catch (error) {
        console.error('Connection test error:', error);
        return {
            success: false,
            error: error?.message || 'Connection test failed'
        };
    }
}

// ===== Context Menu (optional) =====
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'ai-translate',
        title: 'Translate with AI Translator',
        contexts: ['selection']
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'ai-translate' && info.selectionText) {
        // Send message to content script to translate
        chrome.tabs.sendMessage(tab.id, {
            type: 'CONTEXT_MENU_TRANSLATE',
            text: info.selectionText
        }).catch(() => {
            // Content script might not be loaded
        });
    }
});

// ===== Keyboard Shortcuts =====
chrome.commands.onCommand.addListener((command, tab) => {
    if (command === 'translate-selection') {
        // Send message to content script to get selection and translate
        chrome.tabs.sendMessage(tab.id, {
            type: 'KEYBOARD_TRANSLATE'
        }).catch(() => {
            // Content script might not be loaded
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content/content.js']
            }).then(() => {
                // Retry after injecting content script
                chrome.tabs.sendMessage(tab.id, {
                    type: 'KEYBOARD_TRANSLATE'
                }).catch(() => {});
            }).catch(() => {});
        });
    }
});
