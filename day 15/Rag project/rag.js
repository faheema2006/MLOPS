/**
 * Client-side RAG (Retrieval-Augmented Generation) Engine
 * Manages document chunking, IndexedDB vector storage, embeddings, and similarity retrieval.
 */

// Initialize localForage instances for database separation
const docStore = localforage.createInstance({ name: 'kb-documents' });
const chunkStore = localforage.createInstance({ name: 'kb-chunks' });

/**
 * Splits text into overlapping chunks, respecting paragraphs and sentences.
 * @param {string} text - The input text to chunk.
 * @param {number} size - Maximum characters per chunk.
 * @param {number} overlap - Overlap size in characters.
 * @returns {Array<string>} List of text chunks.
 */
export function chunkText(text, size = 800, overlap = 150) {
    if (!text || text.trim().length === 0) return [];
    
    // Normalize newlines and spaces
    const cleanText = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    const chunks = [];
    let start = 0;
    
    while (start < cleanText.length) {
        let end = start + size;
        
        if (end >= cleanText.length) {
            chunks.push(cleanText.substring(start).trim());
            break;
        }
        
        // Find best boundary to split on (paragraph or sentence)
        let boundary = -1;
        const segment = cleanText.substring(start, end);
        
        // Try paragraph break first (in the last 30% of the chunk)
        const minSplitIndex = Math.floor(size * 0.7);
        const doubleNewline = segment.lastIndexOf('\n\n');
        if (doubleNewline > minSplitIndex) {
            boundary = start + doubleNewline;
        } else {
            // Try single newline
            const newline = segment.lastIndexOf('\n');
            if (newline > minSplitIndex) {
                boundary = start + newline;
            } else {
                // Try sentence boundary (. , ? ! followed by space)
                const sentenceEnd = segment.match(/([.?!])\s/g);
                if (sentenceEnd && sentenceEnd.length > 0) {
                    const lastSentenceChar = segment.lastIndexOf(sentenceEnd[sentenceEnd.length - 1]);
                    if (lastSentenceChar > minSplitIndex) {
                        boundary = start + lastSentenceChar + 1; // include punctuation
                    }
                }
            }
        }
        
        // Fallback to splitting on space or word boundary
        if (boundary === -1) {
            const space = segment.lastIndexOf(' ');
            if (space > minSplitIndex) {
                boundary = start + space;
            } else {
                boundary = end; // hard split
            }
        }
        
        chunks.push(cleanText.substring(start, boundary).trim());
        start = boundary - overlap;
        
        // Prevent infinite loop if overlap is too large or progress stalls
        if (start < 0 || boundary <= start) {
            start = boundary + 1;
        }
    }
    
    // Filter empty chunks
    return chunks.filter(c => c.length > 5);
}

/**
 * Calculates cosine similarity between two vectors.
 */
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0.0 || normB === 0.0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calls the Gemini Embedding API for a batch of text chunks.
 * @param {Array<string>} chunks - Text segments.
 * @param {string} apiKey - Gemini API Key.
 * @returns {Promise<Array<Array<number>>>} Embeddings vectors.
 */
async function generateBatchEmbeddings(chunks, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${apiKey}`;
    
    // Construct request payloads
    const requests = chunks.map(text => ({
        model: 'models/text-embedding-004',
        content: {
            parts: [{ text }]
        }
    }));
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests })
    });
    
    if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `API Embedding Error: Status ${response.status}`);
    }
    
    const data = await response.json();
    return data.embeddings.map(e => e.values);
}

/**
 * Call Gemini Embedding API for a single query.
 */
async function generateQueryEmbedding(query, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
    
    const payload = {
        model: 'models/text-embedding-004',
        content: {
            parts: [{ text: query }]
        }
    };
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
        throw new Error(`Query embedding failed: status ${response.status}`);
    }
    
    const data = await response.json();
    return data.embedding.values;
}

/**
 * Indexes a document into the RAG system.
 * Splits content, fetches embeddings, and saves to IndexedDB.
 * @param {string} filename - Name of file.
 * @param {string} text - The raw text content.
 * @param {string} apiKey - Gemini API Key.
 * @param {number} chunkSize - Max character count for chunks.
 * @param {Function} onProgress - Progress reporting callback (current, total).
 * @returns {Promise<object>} The indexed document info.
 */
export async function indexDocument(filename, text, apiKey, chunkSize = 800, onProgress = null) {
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const chunks = chunkText(text, chunkSize, 150);
    
    if (chunks.length === 0) {
        throw new Error('No indexable text content extracted.');
    }
    
    const totalChunks = chunks.length;
    const vectors = [];
    
    // Process embeddings in small batches to respect rate limits and payload boundaries
    const batchSize = 25;
    for (let i = 0; i < totalChunks; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        if (onProgress) {
            onProgress(i, totalChunks);
        }
        
        let batchVectors;
        try {
            batchVectors = await generateBatchEmbeddings(batch, apiKey);
        } catch (err) {
            // Attempt single embeddings fallback if batch fails
            console.warn('Batch embedding failed, falling back to individual calls...', err);
            batchVectors = [];
            for (const chunk of batch) {
                const vecUrl = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
                const res = await fetch(vecUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: 'models/text-embedding-004', content: { parts: [{ text: chunk }] } })
                });
                if (!res.ok) throw new Error('Local fallback embedding failed.');
                const resData = await res.json();
                batchVectors.push(resData.embedding.values);
            }
        }
        
        vectors.push(...batchVectors);
    }
    
    if (onProgress) {
        onProgress(totalChunks, totalChunks);
    }
    
    // Store Chunks
    for (let idx = 0; idx < totalChunks; idx++) {
        const chunkId = `chunk_${docId}_${idx}`;
        await chunkStore.setItem(chunkId, {
            id: chunkId,
            docId: docId,
            filename: filename,
            index: idx + 1,
            total: totalChunks,
            text: chunks[idx],
            vector: vectors[idx]
        });
    }
    
    // Store Document
    const documentRecord = {
        id: docId,
        name: filename,
        charCount: text.length,
        chunkCount: totalChunks,
        addedAt: Date.now()
    };
    await docStore.setItem(docId, documentRecord);
    
    return documentRecord;
}

/**
 * Basic Keyword Search Engine (TF-IDF Fallback)
 * Calculates keyword match scoring for offline retrieval or fallback.
 */
async function retrieveKeywordMatches(query, topK = 5) {
    const terms = query.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(t => t.length > 2); // ignore small words
    
    if (terms.length === 0) {
        // Fallback to all keywords split
        query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    }
    
    const matches = [];
    
    await chunkStore.iterate((chunk) => {
        let score = 0;
        const chunkTextLower = chunk.text.toLowerCase();
        
        terms.forEach(term => {
            // TF approximation: count occurrences
            const regex = new RegExp(term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
            const count = (chunkTextLower.match(regex) || []).length;
            if (count > 0) {
                score += count * (1 + Math.log(term.length)); // reward longer match matches
            }
        });
        
        // Normalize score by length slightly
        if (score > 0) {
            score = score / Math.sqrt(chunk.text.length);
            matches.push({ chunk, score });
        }
    });
    
    // Sort and slice
    return matches
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map(m => ({ ...m.chunk, score: m.score }));
}

/**
 * Main retrieval function.
 * Matches user query against IndexedDB chunks using chosen strategy.
 */
export async function retrieveContext(query, apiKey, config) {
    const { strategy = 'embeddings', topK = 5 } = config;
    
    // Get all files count first
    const docKeys = await docStore.keys();
    if (docKeys.length === 0) {
        return []; // empty database
    }
    
    if (strategy === 'all') {
        // Retrieve all chunks from database
        const allChunks = [];
        await chunkStore.iterate((chunk) => {
            allChunks.push({ ...chunk, score: 1.0 });
        });
        return allChunks;
    }
    
    if (strategy === 'keyword') {
        return await retrieveKeywordMatches(query, topK);
    }
    
    // Vector Embeddings Strategy
    try {
        const queryVector = await generateQueryEmbedding(query, apiKey);
        const matches = [];
        
        await chunkStore.iterate((chunk) => {
            if (chunk.vector) {
                const score = cosineSimilarity(queryVector, chunk.vector);
                matches.push({ chunk, score });
            }
        });
        
        // Sort descending by score
        return matches
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .map(m => ({ ...m.chunk, score: m.score }));
            
    } catch (err) {
        console.error('Vector search failed, falling back to keyword search...', err);
        return await retrieveKeywordMatches(query, topK);
    }
}

/**
 * Fetches all indexed documents.
 */
export async function getIndexedDocuments() {
    const docs = [];
    await docStore.iterate((value) => {
        docs.push(value);
    });
    return docs.sort((a, b) => b.addedAt - a.addedAt);
}

/**
 * Removes a document and all its associated chunks.
 */
export async function deleteDocument(docId) {
    await docStore.removeItem(docId);
    
    // Find and delete associated chunks
    const chunkKeys = [];
    await chunkStore.iterate((chunk, key) => {
        if (chunk.docId === docId) {
            chunkKeys.push(key);
        }
    });
    
    for (const key of chunkKeys) {
        await chunkStore.removeItem(key);
    }
}

/**
 * Clears the entire database (documents and chunks).
 */
export async function clearAllKnowledge() {
    await docStore.clear();
    await chunkStore.clear();
}
