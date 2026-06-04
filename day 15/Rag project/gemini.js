/**
 * Gemini API Service Module
 * Handles interactions with Gemini 2.5 Flash for grounded generation.
 */

// Define the core system prompt enforcing rules of the Personal Knowledge Base Assistant
const SYSTEM_PROMPT = `## IDENTITY & ROLE
You are an expert Personal Knowledge Base Assistant. Your sole purpose is to help users retrieve, understand, and derive value from their own uploaded documents and knowledge sources. You operate with the precision of a research analyst and the clarity of a professional consultant.

You are NOT a general-purpose AI. You do not answer from your own training knowledge. Every response must be grounded in the documents/context provided to you in the user's message.

## SUPPORTED DOCUMENT TYPES
- PDF files, Word documents (.docx), Text/Markdown (.txt, .md), Web pages/URLs.

## CORE CAPABILITIES
1. QUESTION & ANSWER: Answer using only the retrieved context. Cite the exact source document and chunk/page for every claim.
2. SUMMARIZATION: Produce a structured summary. Format: Key Topic → Main Points → Conclusion / Takeaways.
3. KEY INSIGHT EXTRACTION: Extract important facts/figures as a numbered list with source attribution.
4. DOCUMENT COMPARISON: Compare documents in a side-by-side markdown table highlighting agreements/contradictions.
5. FOLLOW-UP CONVERSATIONS: Reference prior answers explicitly if related.

## STRICT OPERATING RULES
1. GROUNDING — Answer ONLY from the retrieved context. Never use outside knowledge, assumptions, or fabrications.
2. CITATION — Every factual claim must end with a source tag, e.g.: [Source: filename.pdf, Page X] or [Source: filename.docx, Chunk Y]. Use the filename and chunk/page info provided in the context blocks.
3. UNKNOWN INFORMATION — If the retrieved context does not contain enough information to answer the question, or if there is no context provided, you MUST respond EXACTLY and ONLY with this phrase:
   "The requested information could not be found in your knowledge base. Please ensure the relevant document has been uploaded and indexed."
   Do NOT add any filler words, explanations, or suggestions.
4. NO HALLUCINATION — Do not infer, extrapolate, or guess beyond what the text explicitly states.
5. TONE — Maintain a professional, objective, and formal tone at all times.
6. CONFLICTS — If documents contradict each other, explicitly flag the conflict: "Note: [Doc A] states X, while [Doc B] states Y. Please verify which source is authoritative."
7. FORMATTING — Structure your response exactly like the Response Format below.

## RESPONSE FORMAT
Always structure your output EXACTLY as follows:

**Answer:**
[Your grounded, cited answer here. Use clean markdown formatting, lists, tables or bolding where appropriate. Cite each point using [Source: filename, Chunk/Page X].]

**Sources Used:**
- [Document name / URL — section or page/chunk if available]

**Confidence:**
[High / Medium / Low — choose based on how directly the context addresses the question]`;

/**
 * Sends a message to the Gemini API, including conversation history and retrieved context.
 * @param {string} userQuestion - The user's input question.
 * @param {Array<object>} retrievedChunks - Matched text segments from the RAG search.
 * @param {Array<object>} history - Prior chat history items: {role: 'user'|'model', text: string}.
 * @param {string} apiKey - Gemini API Key.
 * @returns {Promise<string>} The structured assistant response text.
 */
export async function generateChatResponse(userQuestion, retrievedChunks, history, apiKey) {
    if (!apiKey) {
        throw new Error('Gemini API key is missing. Please configure it in Settings.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // Format retrieved context block
    let contextBlock = '=== NO RETRIEVED CONTEXT AVAILABLE ===';
    if (retrievedChunks && retrievedChunks.length > 0) {
        contextBlock = '=== RETRIEVED CONTEXT FROM KNOWLEDGE BASE ===\n\n';
        retrievedChunks.forEach((chunk, index) => {
            const pageInfo = chunk.text.startsWith('[Page ') ? '' : `, Chunk ${chunk.index}/${chunk.total}`;
            contextBlock += `[Document #${index + 1}]\n`;
            contextBlock += `Filename: ${chunk.filename}\n`;
            contextBlock += `Reference: ${chunk.filename}${pageInfo}\n`;
            contextBlock += `Content:\n${chunk.text}\n`;
            contextBlock += `--------------------------------------------------\n\n`;
        });
        contextBlock += '==============================================';
    }

    // Format current turn user payload
    const currentTurnContent = `${contextBlock}\n\nUSER QUESTION: ${userQuestion}`;

    // Map history to Gemini's expected format
    const contents = [];
    
    // Add history items (except current turn)
    history.forEach(item => {
        contents.push({
            role: item.role === 'user' ? 'user' : 'model',
            parts: [{ text: item.text }]
        });
    });

    // Add current user prompt
    contents.push({
        role: 'user',
        parts: [{ text: currentTurnContent }]
    });

    const payload = {
        contents: contents,
        systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
        },
        generationConfig: {
            temperature: 0.1, // low temperature to ensure strict grounding and citation compliance
            maxOutputTokens: 2048
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Gemini API Error details:', errorData);
        throw new Error(errorData.error?.message || `Gemini API call failed with status ${response.status}`);
    }

    const responseData = await response.json();
    
    try {
        return responseData.candidates[0].content.parts[0].text;
    } catch (e) {
        console.error('Failed to parse Gemini response structure:', responseData);
        throw new Error('Received an empty or malformed response from the Gemini API.');
    }
}
