/**
 * Document Parser Module
 * Handles client-side extraction of text from various document types.
 */

/**
 * Main parse entry point. Resolves file type and delegates to specific parsers.
 * @param {File} file - The file object to parse.
 * @returns {Promise<string>} The extracted text content.
 */
export async function parseFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    
    switch (extension) {
        case 'txt':
        case 'md':
            return await parseText(file);
        case 'pdf':
            return await parsePDF(file);
        case 'docx':
            return await parseDOCX(file);
        default:
            throw new Error(`Unsupported file type: .${extension}`);
    }
}

/**
 * Reads plain text or markdown files.
 */
function parseText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read text file.'));
        reader.readAsText(file);
    });
}

/**
 * Extracts text from PDF files using PDF.js.
 */
async function parsePDF(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const arrayBuffer = reader.result;
                const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = '';
                
                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const content = await page.getTextContent();
                    const pageText = content.items
                        .map(item => item.str)
                        .join(' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                    
                    if (pageText) {
                        fullText += `[Page ${pageNum}]\n${pageText}\n\n`;
                    }
                }
                
                if (!fullText.trim()) {
                    reject(new Error('PDF file has no extractable text layer (it might be scanned).'));
                } else {
                    resolve(fullText);
                }
            } catch (err) {
                reject(new Error(`PDF parsing failed: ${err.message}`));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read PDF file binary data.'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Extracts text from DOCX files using mammoth.js.
 */
async function parseDOCX(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const arrayBuffer = reader.result;
                const result = await window.mammoth.extractRawText({ arrayBuffer });
                if (result.value) {
                    resolve(result.value);
                } else {
                    reject(new Error('Word document is empty or text could not be extracted.'));
                }
            } catch (err) {
                reject(new Error(`DOCX parsing failed: ${err.message}`));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read DOCX file binary data.'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Fetches and parses a web page.
 * @param {string} url - The URL to fetch.
 * @param {boolean} useProxy - Whether to route through a CORS proxy.
 * @returns {Promise<{title: string, text: string}>} Extracted title and text content.
 */
export async function parseURL(url, useProxy = true) {
    let fetchUrl = url;
    if (useProxy) {
        fetchUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    }
    
    try {
        const response = await fetch(fetchUrl);
        if (!response.ok) {
            throw new Error(`Server returned status code: ${response.status}`);
        }
        
        const html = await response.text();
        const domParser = new DOMParser();
        const doc = domParser.parseFromString(html, 'text/html');
        
        // Strip script, style, and navigation tags
        const tagsToRemove = ['script', 'style', 'nav', 'footer', 'header', 'iframe', 'noscript'];
        tagsToRemove.forEach(tag => {
            const elements = doc.querySelectorAll(tag);
            elements.forEach(el => el.remove());
        });
        
        // Get Title
        const title = doc.querySelector('title')?.textContent?.trim() || new URL(url).hostname;
        
        // Try to get primary content area
        const contentSelectors = [
            'article', 'main', '.post-content', '.article-content', '.content', '#content'
        ];
        let contentEl = null;
        for (const selector of contentSelectors) {
            contentEl = doc.querySelector(selector);
            if (contentEl) break;
        }
        
        // Fallback to body if no main article area is found
        if (!contentEl) {
            contentEl = doc.body;
        }
        
        if (!contentEl) {
            throw new Error('Webpage body could not be parsed.');
        }
        
        // Extract paragraph texts to form a clean layout
        const blocks = [];
        const headingsAndParagraphs = contentEl.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li');
        
        headingsAndParagraphs.forEach(el => {
            const text = el.textContent?.trim().replace(/\s+/g, ' ');
            if (text && text.length > 10) {
                if (el.tagName.startsWith('H')) {
                    blocks.push(`\n## ${text}\n`);
                } else if (el.tagName === 'LI') {
                    blocks.push(`- ${text}`);
                } else {
                    blocks.push(text);
                }
            }
        });
        
        const cleanText = blocks.join('\n\n');
        
        if (!cleanText.trim()) {
            throw new Error('No readable text content found on the page.');
        }
        
        return { title, text: cleanText };
    } catch (err) {
        console.error('URL Fetch Error:', err);
        throw new Error(`Unable to fetch external site content: ${err.message}`);
    }
}
