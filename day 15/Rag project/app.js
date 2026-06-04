/**
 * Application Entry & UI Coordinator
 * Connects the Parser, RAG, and Gemini API modules with user interaction.
 */

import { parseFile, parseURL } from './parser.js';
import { 
    indexDocument, 
    retrieveContext, 
    getIndexedDocuments, 
    deleteDocument, 
    clearAllKnowledge 
} from './rag.js';
import { generateChatResponse } from './gemini.js';

// Default Gemini API Key provided by user
const DEFAULT_API_KEY = "Your_Gemini_API_Key_Here";

// Application State
const state = {
    apiKey: DEFAULT_API_KEY,
    chatHistory: [], // elements format: { role: 'user' | 'model', text: string, retrievedChunks?: [] }
    documents: [],
    retrievalStrategy: localStorage.getItem('kb_retrieval_strategy') || 'embeddings',
    chunkSize: parseInt(localStorage.getItem('kb_chunk_size')) || 800,
    topK: parseInt(localStorage.getItem('kb_top_k')) || 5,
    isProcessingFile: false
};

// DOM References
const elements = {
    uploadZone: document.getElementById('upload-zone'),
    fileInput: document.getElementById('file-input'),
    urlInput: document.getElementById('url-input'),
    addUrlBtn: document.getElementById('add-url-btn'),
    useProxyCheck: document.getElementById('use-proxy'),
    fileList: document.getElementById('file-list'),
    indexedCountText: document.getElementById('indexed-count-text'),
    clearAllBtn: document.getElementById('clear-all-btn'),
    
    statChunks: document.getElementById('stat-chunks'),
    statChars: document.getElementById('stat-chars'),
    chatSubtitle: document.getElementById('chat-subtitle'),
    
    messagesStream: document.getElementById('messages-stream'),
    welcomeView: document.getElementById('welcome-view'),
    starterSuggestions: document.getElementById('starter-suggestions-box'),
    chatInput: document.getElementById('chat-input'),
    sendBtn: document.getElementById('send-btn'),
    clearChatBtn: document.getElementById('clear-chat-btn'),
    ragStatusText: document.getElementById('rag-status-text'),
    
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    
    retrievalStrategy: document.getElementById('retrieval-strategy'),
    chunkSizeSlider: document.getElementById('chunk-size-slider'),
    chunkSizeVal: document.getElementById('chunk-size-val'),
    topKSlider: document.getElementById('top-k-slider'),
    topKVal: document.getElementById('top-k-val'),
    contextInspector: document.getElementById('context-inspector'),
    
    // Modal elements
    scraperModal: document.getElementById('scraper-modal'),
    manualUrlTitle: document.getElementById('manual-url-title'),
    manualUrlAddress: document.getElementById('manual-url-address'),
    manualUrlContent: document.getElementById('manual-url-content'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    cancelModalBtn: document.getElementById('cancel-modal-btn'),
    saveModalBtn: document.getElementById('save-modal-btn'),
    
    // Mobile layouts
    mobileMenuLeft: document.getElementById('mobile-menu-left'),
    mobileMenuRight: document.getElementById('mobile-menu-right'),
    closeRightSidebar: document.getElementById('close-right-sidebar'),
    sidebarLeft: document.getElementById('sidebar-left'),
    sidebarRight: document.getElementById('sidebar-right')
};

/* ==========================================================================
   INITIALIZATION & BOOTSTRAP
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
    initSettingsValues();
    initTheme();
    setupEventListeners();
    await loadKnowledgeBase();
    updateSendButtonState();
    
    // Render starting history if any stored
    const savedHistory = localStorage.getItem('kb_chat_history');
    if (savedHistory) {
        try {
            state.chatHistory = JSON.parse(savedHistory);
            renderChatHistory();
        } catch (e) {
            console.error('Failed to load chat history:', e);
        }
    }
    
    // Auto-scroll input textarea
    autoResizeTextarea(elements.chatInput);
    
    // Refresh Icons
    lucide.createIcons();
});

function initSettingsValues() {
    elements.retrievalStrategy.value = state.retrievalStrategy;
    
    elements.chunkSizeSlider.value = state.chunkSize;
    elements.chunkSizeVal.textContent = state.chunkSize;
    
    elements.topKSlider.value = state.topK;
    elements.topKVal.textContent = state.topK;
    
    // Hide sliders if using strategy "all"
    toggleSliderVisibility(state.retrievalStrategy);
}

function initTheme() {
    const savedTheme = localStorage.getItem('kb_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

/* ==========================================================================
   SETTINGS & UTILITIES
   ========================================================================== */

function saveConfig(key, value) {
    state[key] = value;
    localStorage.setItem(`kb_${key.replace(/([A-Z])/g, '_$1').toLowerCase()}`, value);
}

function toggleSliderVisibility(strategy) {
    if (strategy === 'all') {
        document.getElementById('chunk-size-group').style.display = 'none';
        document.getElementById('top-k-group').style.display = 'none';
    } else {
        document.getElementById('chunk-size-group').style.display = 'flex';
        document.getElementById('top-k-group').style.display = 'flex';
    }
}

function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
}

function updateSendButtonState() {
    const hasDocuments = state.documents.length > 0;
    const hasText = elements.chatInput.value.trim().length > 0;
    
    elements.sendBtn.disabled = !hasText;
    
    if (hasDocuments) {
        elements.ragStatusText.textContent = `Index Ready (${state.documents.length} docs)`;
        elements.ragStatusText.style.color = 'var(--success)';
        elements.starterSuggestions.style.display = 'block';
    } else {
        elements.ragStatusText.textContent = "No documents indexed";
        elements.ragStatusText.style.color = 'var(--text-muted)';
        elements.starterSuggestions.style.display = 'none';
    }
}

/* ==========================================================================
   THEMING & LAYOUT TRIGGERS
   ========================================================================== */

elements.themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('kb_theme', newTheme);
});

// Mobile Toggles
elements.mobileMenuLeft.addEventListener('click', () => {
    elements.sidebarLeft.classList.toggle('active');
    elements.sidebarRight.classList.remove('active');
});

elements.mobileMenuRight.addEventListener('click', () => {
    elements.sidebarRight.classList.toggle('active');
    elements.sidebarLeft.classList.remove('active');
});

elements.closeRightSidebar.addEventListener('click', () => {
    elements.sidebarRight.classList.remove('active');
});

// Close sidebars on clicking chat area
document.querySelector('.chat-container').addEventListener('click', () => {
    elements.sidebarLeft.classList.remove('active');
    elements.sidebarRight.classList.remove('active');
});

/* ==========================================================================
   EVENT HANDLERS
   ========================================================================== */

function setupEventListeners() {
    // API Configuration Listeners removed (hardcoded key in use)
    
    elements.retrievalStrategy.addEventListener('change', (e) => {
        saveConfig('retrievalStrategy', e.target.value);
        toggleSliderVisibility(e.target.value);
    });
    
    elements.chunkSizeSlider.addEventListener('input', (e) => {
        elements.chunkSizeVal.textContent = e.target.value;
    });
    
    elements.chunkSizeSlider.addEventListener('change', (e) => {
        saveConfig('chunkSize', parseInt(e.target.value));
        showToast("Chunk size changes will apply to new documents uploaded.", "info");
    });
    
    elements.topKSlider.addEventListener('input', (e) => {
        elements.topKVal.textContent = e.target.value;
    });
    
    elements.topKSlider.addEventListener('change', (e) => {
        saveConfig('topK', parseInt(e.target.value));
    });
    
    // File upload zones listeners
    elements.uploadZone.addEventListener('click', () => {
        if (!state.isProcessingFile) elements.fileInput.click();
    });
    
    elements.uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadZone.classList.add('dragover');
    });
    
    elements.uploadZone.addEventListener('dragleave', () => {
        elements.uploadZone.classList.remove('dragover');
    });
    
    elements.uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadZone.classList.remove('dragover');
        if (state.isProcessingFile) return;
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files);
        }
    });
    
    elements.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files);
        }
    });
    
    // URL input
    elements.addUrlBtn.addEventListener('click', handleURLSubmit);
    elements.urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleURLSubmit();
    });
    
    // Clear KB Data
    elements.clearAllBtn.addEventListener('click', async () => {
        if (confirm("Are you sure you want to delete all indexed documents and clear the vector database?")) {
            await clearAllKnowledge();
            await loadKnowledgeBase();
            elements.contextInspector.innerHTML = `<div class="empty-inspector">No questions asked yet. Ask a question to view matching text segments.</div>`;
            showToast("Database successfully cleared.", "success");
        }
    });
    
    // Clear Chat
    elements.clearChatBtn.addEventListener('click', () => {
        state.chatHistory = [];
        localStorage.removeItem('kb_chat_history');
        renderChatHistory();
        showToast("Conversation cleared.", "info");
    });
    
    // Textarea resize & submit listeners
    elements.chatInput.addEventListener('input', (e) => {
        autoResizeTextarea(e.target);
        updateSendButtonState();
    });
    
    elements.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleChatSubmit();
        }
    });
    
    elements.sendBtn.addEventListener('click', handleChatSubmit);
    
    // Suggestion chips delegation
    document.getElementById('suggestion-chips').addEventListener('click', (e) => {
        const btn = e.target.closest('.suggestion-chip');
        if (btn) {
            elements.chatInput.value = btn.getAttribute('data-prompt');
            autoResizeTextarea(elements.chatInput);
            updateSendButtonState();
            elements.chatInput.focus();
        }
    });
    
    // Citation click delegation in message list
    elements.messagesStream.addEventListener('click', (e) => {
        const citation = e.target.closest('.citation-link');
        if (citation) {
            e.preventDefault();
            const filename = citation.getAttribute('data-filename');
            const details = citation.getAttribute('data-details');
            highlightContextSegment(filename, details);
        }
    });
    
    // Modal controls
    elements.closeModalBtn.addEventListener('click', hideModal);
    elements.cancelModalBtn.addEventListener('click', hideModal);
    elements.saveModalBtn.addEventListener('click', handleManualScrapeSave);
}

/* ==========================================================================
   KNOWLEDGE LOAD & STATS
   ========================================================================== */

async function loadKnowledgeBase() {
    state.documents = await getIndexedDocuments();
    renderFileList();
    await updateStats();
    updateSendButtonState();
}

function renderFileList() {
    elements.fileList.innerHTML = '';
    
    if (state.documents.length === 0) {
        elements.fileList.appendChild(elements.emptyListMessage || createEmptyMsgNode());
        elements.chatSubtitle.textContent = "Grounded in 0 documents";
        elements.indexedCountText.textContent = "Indexed Documents (0)";
        return;
    }
    
    elements.indexedCountText.textContent = `Indexed Documents (${state.documents.length})`;
    elements.chatSubtitle.textContent = `Grounded in ${state.documents.length} document${state.documents.length > 1 ? 's' : ''}`;
    
    state.documents.forEach(doc => {
        const item = document.createElement('div');
        item.className = 'file-item';
        
        const isUrl = doc.name.startsWith('http://') || doc.name.startsWith('https://');
        const iconName = isUrl ? 'globe' : 'file-text';
        
        item.innerHTML = `
            <div class="file-item-header">
                <div class="file-info">
                    <i data-lucide="${iconName}" class="file-icon"></i>
                    <span class="file-name" title="${doc.name}">${doc.name}</span>
                </div>
                <button class="delete-file-btn" data-id="${doc.id}" title="Remove source"><i data-lucide="x"></i></button>
            </div>
            <div class="file-meta">
                <span class="file-size">${formatBytes(doc.charCount)} text</span>
                <span class="file-status">
                    <i data-lucide="check-circle-2" class="status-ready"></i> Ready
                </span>
            </div>
        `;
        
        // Event listener for deleting files
        item.querySelector('.delete-file-btn').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const docId = btn.getAttribute('data-id');
            const docName = state.documents.find(d => d.id === docId)?.name || 'Document';
            
            if (confirm(`Remove "${docName}" from index?`)) {
                await deleteDocument(docId);
                await loadKnowledgeBase();
                showToast(`Removed "${docName}" from database.`, "info");
            }
        });
        
        elements.fileList.appendChild(item);
    });
    
    lucide.createIcons();
}

function createEmptyMsgNode() {
    const div = document.createElement('div');
    div.className = 'empty-list-message';
    div.id = 'empty-list-msg';
    div.textContent = 'No documents indexed yet. Upload documents or add URLs to populate your knowledge base.';
    elements.emptyListMessage = div;
    return div;
}

async function updateStats() {
    let totalChunks = 0;
    let totalChars = 0;
    
    state.documents.forEach(doc => {
        totalChunks += doc.chunkCount;
        totalChars += doc.charCount;
    });
    
    elements.statChunks.textContent = totalChunks.toLocaleString();
    elements.statChars.textContent = totalChars.toLocaleString();
}

/* ==========================================================================
   DOCUMENT PROCESSORS (FILE / URL)
   ========================================================================== */

async function handleFileUpload(files) {
    if (!state.apiKey) {
        showToast("Please supply a Gemini API Key first to generate text embeddings.", "error");
        return;
    }
    
    state.isProcessingFile = true;
    elements.uploadZone.style.opacity = '0.6';
    elements.uploadZone.style.cursor = 'wait';
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const placeholderId = addTemporaryFileItem(file.name);
        
        try {
            const text = await parseFile(file);
            const docInfo = await indexDocument(
                file.name, 
                text, 
                state.apiKey, 
                state.chunkSize,
                (curr, total) => updateFileItemProgress(placeholderId, curr, total)
            );
            
            replacePlaceholderWithReady(placeholderId, docInfo);
            await loadKnowledgeBase();
            showToast(`Indexed "${file.name}" successfully!`, "success");
        } catch (err) {
            console.error('Error indexing file:', file.name, err);
            markPlaceholderAsError(placeholderId, err.message);
            showToast(`Failed to parse file: ${file.name}. ${err.message}`, "error");
        }
    }
    
    state.isProcessingFile = false;
    elements.uploadZone.style.opacity = '1';
    elements.uploadZone.style.cursor = 'pointer';
}

async function handleURLSubmit() {
    const urlVal = elements.urlInput.value.trim();
    if (!urlVal) return;
    
    if (!state.apiKey) {
        showToast("Please supply a Gemini API Key first to generate text embeddings.", "error");
        return;
    }
    
    if (!urlVal.startsWith('http://') && !urlVal.startsWith('https://')) {
        showToast("Please provide a valid web URL starting with http:// or https://", "error");
        return;
    }
    
    elements.addUrlBtn.disabled = true;
    elements.urlInput.disabled = true;
    
    const placeholderId = addTemporaryFileItem(urlVal);
    const useProxy = elements.useProxyCheck.checked;
    
    try {
        const parsed = await parseURL(urlVal, useProxy);
        
        const docInfo = await indexDocument(
            urlVal,
            parsed.text,
            state.apiKey,
            state.chunkSize,
            (curr, total) => updateFileItemProgress(placeholderId, curr, total)
        );
        
        replacePlaceholderWithReady(placeholderId, docInfo);
        await loadKnowledgeBase();
        elements.urlInput.value = '';
        showToast(`Indexed web page: ${parsed.title}`, "success");
    } catch (err) {
        console.warn('URL scraping failed. Activating manual fallback modal.', err);
        // Remove the temporary visual list element since it failed
        removeTemporaryFileItem(placeholderId);
        
        // Open Fallback Modal
        showManualScraperModal(urlVal);
    } finally {
        elements.addUrlBtn.disabled = false;
        elements.urlInput.disabled = false;
    }
}

/* ==========================================================================
   TEMPORARY UI INDICATORS
   ========================================================================== */

function addTemporaryFileItem(name) {
    const id = `temp_${Date.now()}`;
    const emptyMsg = document.getElementById('empty-list-msg');
    if (emptyMsg) emptyMsg.remove();
    
    const item = document.createElement('div');
    item.className = 'file-item';
    item.id = id;
    
    const isUrl = name.startsWith('http://') || name.startsWith('https://');
    const iconName = isUrl ? 'globe' : 'file-text';
    
    item.innerHTML = `
        <div class="file-item-header">
            <div class="file-info">
                <i data-lucide="${iconName}" class="file-icon"></i>
                <span class="file-name" title="${name}">${name}</span>
            </div>
        </div>
        <div class="file-meta">
            <span class="file-size" id="size-${id}">Extracting text...</span>
            <span class="file-status" id="status-${id}">
                <i data-lucide="loader" class="status-indexing spinning"></i> <span>Initializing...</span>
            </span>
        </div>
    `;
    
    elements.fileList.appendChild(item);
    lucide.createIcons();
    return id;
}

function updateFileItemProgress(id, current, total) {
    const sizeSpan = document.getElementById(`size-${id}`);
    const statusSpan = document.getElementById(`status-${id}`);
    if (sizeSpan && statusSpan) {
        sizeSpan.textContent = `Chunking text...`;
        statusSpan.innerHTML = `
            <i data-lucide="loader" class="status-indexing spinning"></i> 
            <span>Embedding (${current}/${total})</span>
        `;
        lucide.createIcons();
    }
}

function replacePlaceholderWithReady(placeholderId, docInfo) {
    const placeholder = document.getElementById(placeholderId);
    if (placeholder) {
        placeholder.remove();
    }
}

function markPlaceholderAsError(id, errorText) {
    const statusSpan = document.getElementById(`status-${id}`);
    const sizeSpan = document.getElementById(`size-${id}`);
    if (statusSpan && sizeSpan) {
        sizeSpan.textContent = 'Parsing failed';
        statusSpan.innerHTML = `
            <i data-lucide="alert-circle" class="status-error"></i> 
            <span class="status-error" title="${errorText}">Error</span>
        `;
        
        // Add a delete button to clear the error item
        const header = document.getElementById(id).querySelector('.file-item-header');
        if (header && !header.querySelector('.delete-file-btn')) {
            const btn = document.createElement('button');
            btn.className = 'delete-file-btn';
            btn.innerHTML = '<i data-lucide="x"></i>';
            btn.addEventListener('click', () => document.getElementById(id).remove());
            header.appendChild(btn);
        }
        
        lucide.createIcons();
    }
}

function removeTemporaryFileItem(id) {
    const item = document.getElementById(id);
    if (item) item.remove();
    if (elements.fileList.children.length === 0) {
        renderFileList();
    }
}

/* ==========================================================================
   MANUAL MODAL SCRAPER FALLBACK
   ========================================================================== */

function showManualScraperModal(url) {
    elements.manualUrlAddress.value = url;
    elements.manualUrlTitle.value = new URL(url).hostname;
    elements.manualUrlContent.value = '';
    elements.scraperModal.classList.add('active');
    elements.manualUrlContent.focus();
}

function hideModal() {
    elements.scraperModal.classList.remove('active');
}

async function handleManualScrapeSave() {
    const url = elements.manualUrlAddress.value;
    const title = elements.manualUrlTitle.value.trim() || new URL(url).hostname;
    const text = elements.manualUrlContent.value.trim();
    
    if (!text) {
        showToast("Please paste the page content text to proceed.", "error");
        return;
    }
    
    hideModal();
    const placeholderId = addTemporaryFileItem(title);
    
    try {
        const docInfo = await indexDocument(
            url, // Store original URL as source
            `Title: ${title}\n\n${text}`,
            state.apiKey,
            state.chunkSize,
            (curr, total) => updateFileItemProgress(placeholderId, curr, total)
        );
        
        replacePlaceholderWithReady(placeholderId, docInfo);
        await loadKnowledgeBase();
        elements.urlInput.value = '';
        showToast(`Successfully indexed: ${title}`, "success");
    } catch (err) {
        console.error('Manual index failed:', err);
        markPlaceholderAsError(placeholderId, err.message);
        showToast(`Failed to index manually pasted text: ${err.message}`, "error");
    }
}

/* ==========================================================================
   CHAT / GENERATION FLOW
   ========================================================================== */

async function handleChatSubmit() {
    const query = elements.chatInput.value.trim();
    if (!query) return;
    
    if (state.documents.length === 0) {
        showToast("Please upload and index documents before asking questions.", "error");
        return;
    }
    
    if (!state.apiKey) {
        showToast("Please configure your Gemini API Key in the settings panel.", "error");
        return;
    }
    
    // Clear Input UI
    elements.chatInput.value = '';
    elements.chatInput.style.height = 'auto';
    updateSendButtonState();
    
    // Hide Welcome Screen on first interaction
    elements.welcomeView.style.display = 'none';
    
    // Add user bubble
    appendMessageBubble('user', query);
    scrollChatToBottom();
    
    // Add temporary loading indicator bubble
    const loadingBubbleId = appendLoadingBubble();
    scrollChatToBottom();
    
    try {
        // Retrieve Chunks (Context)
        const config = { strategy: state.retrievalStrategy, topK: state.topK };
        const chunks = await retrieveContext(query, state.apiKey, config);
        
        // Cache chunks for right sidebar context inspector
        state.lastRetrievedChunks = chunks;
        renderContextInspector(chunks);
        
        // Call Gemini Model
        const apiResponse = await generateChatResponse(query, chunks, state.chatHistory, state.apiKey);
        
        // Remove loading bubble
        removeBubble(loadingBubbleId);
        
        // Format & render responses
        const structured = parseStructuredResponse(apiResponse);
        appendMessageBubble('assistant', structured.answer, chunks, structured.sources, structured.confidence);
        
        // Add to history state
        // Keep the clean prompt and grounded response in session logs
        state.chatHistory.push(
            { role: 'user', text: `=== RETRIEVED CONTEXT ===\n(Context injected during turn)\n=== USER QUESTION ===\n${query}` },
            { role: 'model', text: apiResponse }
        );
        localStorage.setItem('kb_chat_history', JSON.stringify(state.chatHistory));
        
        scrollChatToBottom();
    } catch (err) {
        console.error('Chat error:', err);
        removeBubble(loadingBubbleId);
        appendMessageBubble('assistant', `**Error during generation**: ${err.message}. Please verify your Gemini API key and internet connection.`);
        scrollChatToBottom();
    }
}

function parseStructuredResponse(response) {
    // Look for Answer block
    let answerText = response;
    let sourcesText = '';
    let confidenceText = 'Medium'; // default fallback
    
    // Standard response splits
    const ansPrefix = "**Answer:**";
    const srcPrefix = "**Sources Used:**";
    const confPrefix = "**Confidence:**";
    
    const ansIdx = response.indexOf(ansPrefix);
    const srcIdx = response.indexOf(srcPrefix);
    const confIdx = response.indexOf(confPrefix);
    
    if (ansIdx !== -1) {
        const endOfAns = srcIdx !== -1 ? srcIdx : (confIdx !== -1 ? confIdx : response.length);
        answerText = response.substring(ansIdx + ansPrefix.length, endOfAns).trim();
    } else if (srcIdx !== -1) {
        // Model omitted "**Answer:**" but has "**Sources Used:**"
        answerText = response.substring(0, srcIdx).trim();
    }
    
    if (srcIdx !== -1) {
        const endOfSrc = confIdx !== -1 ? confIdx : response.length;
        sourcesText = response.substring(srcIdx + srcPrefix.length, endOfSrc).trim();
    }
    
    if (confIdx !== -1) {
        confidenceText = response.substring(confIdx + confPrefix.length).trim();
    }
    
    return {
        answer: answerText,
        sources: sourcesText,
        confidence: confidenceText
    };
}

function appendMessageBubble(role, content, chunks = [], sourcesText = '', confidence = '') {
    const messageNode = document.createElement('div');
    messageNode.className = `message message-${role}`;
    
    const avatar = role === 'user' ? 'user' : 'bot';
    const avatarIcon = role === 'user' ? 'user' : 'sparkles';
    
    let bubbleContent = '';
    if (role === 'user') {
        // Simple text escaping for security
        const safeText = content.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
        bubbleContent = `<div class="message-bubble">${safeText}</div>`;
    } else {
        // Format citations first, then parse Markdown
        const citedText = formatCitations(content);
        const html = marked.parse(citedText);
        
        let footerHtml = '';
        if (sourcesText || confidence) {
            let confClass = 'conf-medium';
            const cleanConf = confidence.trim().toLowerCase();
            if (cleanConf.includes('high')) confClass = 'conf-high';
            if (cleanConf.includes('low')) confClass = 'conf-low';
            
            let sourceListItems = '';
            if (sourcesText) {
                // Split list items
                const lines = sourcesText.split('\n').filter(line => line.trim().startsWith('-'));
                if (lines.length > 0) {
                    sourceListItems = lines.map(line => {
                        const cleanLine = line.replace(/^-\s*/, '').trim();
                        return `<div class="meta-source-item"><i data-lucide="link" class="file-icon"></i> <span>${cleanLine}</span></div>`;
                    }).join('');
                } else {
                    sourceListItems = `<div class="meta-source-item"><i data-lucide="link" class="file-icon"></i> <span>${sourcesText.replace(/^[-\*\s]*/, '')}</span></div>`;
                }
            }
            
            footerHtml = `
                <div class="meta-section">
                    ${sourceListItems ? `<div class="meta-sources">${sourceListItems}</div>` : ''}
                    ${confidence ? `<div>Confidence: <span class="meta-confidence ${confClass}">${confidence}</span></div>` : ''}
                </div>
            `;
        }
        
        bubbleContent = `<div class="message-bubble">${html}${footerHtml}</div>`;
    }
    
    messageNode.innerHTML = `
        <div class="message-avatar" title="${role === 'user' ? 'User' : 'Assistant'}">
            <i data-lucide="${avatarIcon}"></i>
        </div>
        ${bubbleContent}
    `;
    
    elements.messagesStream.appendChild(messageNode);
    lucide.createIcons();
    return messageNode;
}

function appendLoadingBubble() {
    const id = `loading_${Date.now()}`;
    const messageNode = document.createElement('div');
    messageNode.className = 'message message-assistant';
    messageNode.id = id;
    
    messageNode.innerHTML = `
        <div class="message-avatar">
            <i data-lucide="sparkles"></i>
        </div>
        <div class="message-bubble">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    
    elements.messagesStream.appendChild(messageNode);
    lucide.createIcons();
    return id;
}

function removeBubble(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function renderChatHistory() {
    elements.messagesStream.innerHTML = '';
    
    if (state.chatHistory.length === 0) {
        elements.messagesStream.appendChild(elements.welcomeView);
        elements.welcomeView.style.display = 'flex';
        return;
    }
    
    elements.welcomeView.style.display = 'none';
    
    // Process pairs of user/assistant turns
    for (let i = 0; i < state.chatHistory.length; i += 2) {
        const userTurn = state.chatHistory[i];
        const assistantTurn = state.chatHistory[i + 1];
        
        if (userTurn) {
            // Strip the retrieved context section out before rendering user query
            let cleanText = userTurn.text;
            const qIdx = cleanText.indexOf('=== USER QUESTION ===');
            if (qIdx !== -1) {
                cleanText = cleanText.substring(qIdx + 21).trim();
            }
            appendMessageBubble('user', cleanText);
        }
        
        if (assistantTurn) {
            const structured = parseStructuredResponse(assistantTurn.text);
            appendMessageBubble('assistant', structured.answer, [], structured.sources, structured.confidence);
        }
    }
    
    scrollChatToBottom();
}

function scrollChatToBottom() {
    elements.messagesStream.scrollTop = elements.messagesStream.scrollHeight;
}

/* ==========================================================================
   CITATION HIGHLIGHTS & INSPECTOR
   ========================================================================== */

function formatCitations(text) {
    // Replaces [Source: document.pdf, Section 3] or [Source: filename, Chunk 1] with styled buttons
    return text.replace(/\[Source:\s*([^,\]]+)(?:,\s*([^\]]+))?\]/gi, (match, filename, details) => {
        const cleanFilename = filename.trim();
        const cleanDetails = details ? details.trim() : '';
        return `<button class="citation-link" data-filename="${cleanFilename}" data-details="${cleanDetails}" title="Click to inspect this citation source">${match}</button>`;
    });
}

function renderContextInspector(chunks) {
    elements.contextInspector.innerHTML = '';
    
    if (!chunks || chunks.length === 0) {
        elements.contextInspector.innerHTML = `
            <div class="empty-inspector">
                No matching chunks found in index. Verify that your retrieval parameters or query text are valid.
            </div>
        `;
        return;
    }
    
    chunks.forEach((c) => {
        const scorePct = c.score ? `${Math.round(c.score * 100)}%` : 'N/A';
        const chunkDiv = document.createElement('div');
        chunkDiv.className = 'inspected-chunk';
        chunkDiv.dataset.filename = c.filename;
        chunkDiv.dataset.index = c.index;
        
        chunkDiv.innerHTML = `
            <div class="chunk-header">
                <span class="chunk-source" title="${c.filename}">${c.filename} (Ch. ${c.index})</span>
                <span class="chunk-score" title="Cosine similarity score">${scorePct}</span>
            </div>
            <div class="chunk-text">${escapeHTML(c.text)}</div>
        `;
        
        elements.contextInspector.appendChild(chunkDiv);
    });
}

function highlightContextSegment(filename, details) {
    // Open right sidebar on mobile
    if (window.innerWidth <= 1024) {
        elements.sidebarRight.classList.add('active');
        elements.sidebarLeft.classList.remove('active');
    }
    
    const chunks = elements.contextInspector.querySelectorAll('.inspected-chunk');
    let found = false;
    
    // Find details index if formatted like "Chunk 1/5" or "Chunk 1"
    let indexMatch = null;
    if (details) {
        const match = details.match(/(\d+)/);
        if (match) indexMatch = parseInt(match[1]);
    }
    
    chunks.forEach(el => {
        const elFilename = el.getAttribute('data-filename');
        const elIndex = parseInt(el.getAttribute('data-index'));
        
        // Remove prior highlight classes
        el.classList.remove('highlighted');
        el.style.borderColor = 'var(--border-color)';
        el.style.backgroundColor = 'var(--bg-secondary)';
        
        // Compare values
        const fileMatches = elFilename.toLowerCase().includes(filename.toLowerCase()) || 
                            filename.toLowerCase().includes(elFilename.toLowerCase());
        const indexMatches = indexMatch === null || elIndex === indexMatch;
        
        if (fileMatches && indexMatches && !found) {
            found = true;
            el.classList.add('highlighted');
            el.style.borderColor = 'var(--border-focus)';
            el.style.backgroundColor = 'rgba(99, 102, 241, 0.08)';
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });
    
    if (!found) {
        showToast(`Could not locate chunk for: ${filename} (${details || 'any'}) in current context inspector list.`, "info");
    }
}

/* ==========================================================================
   FORMATTERS & HELPER UI
   ========================================================================== */

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['chars', 'KB', 'MB', 'GB'];
    // For character counts, outputting count is intuitive, but we support size layouts
    if (bytes < k) return `${bytes} characters`;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
    // Dynamic toast alerts
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'alert-triangle';
    
    toast.innerHTML = `
        <i data-lucide="${icon}"></i>
        <span>${message}</span>
    `;
    
    // Style toast container programmatically or append to a body wrapper
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.position = 'fixed';
        container.style.bottom = '2rem';
        container.style.right = '2rem';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '0.5rem';
        container.style.zIndex = '1000';
        document.body.appendChild(container);
    }
    
    // Add custom inline CSS style rules for toast items
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '0.75rem';
    toast.style.padding = '0.75rem 1.25rem';
    toast.style.borderRadius = 'var(--radius-md)';
    toast.style.fontSize = '0.85rem';
    toast.style.fontWeight = '500';
    toast.style.boxShadow = 'var(--shadow-lg)';
    toast.style.border = '1px solid var(--border-color)';
    toast.style.animation = 'slideUp 0.3s ease, fadeIn 0.3s ease';
    toast.style.transition = 'all 0.3s ease';
    
    if (type === 'success') {
        toast.style.backgroundColor = 'var(--bg-secondary)';
        toast.style.borderColor = 'var(--success)';
        toast.style.color = 'var(--success)';
    } else if (type === 'error') {
        toast.style.backgroundColor = 'var(--bg-secondary)';
        toast.style.borderColor = 'var(--error)';
        toast.style.color = 'var(--error)';
    } else {
        toast.style.backgroundColor = 'var(--bg-secondary)';
        toast.style.borderColor = 'var(--border-color)';
        toast.style.color = 'var(--text-primary)';
    }
    
    container.appendChild(toast);
    lucide.createIcons();
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
