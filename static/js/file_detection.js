/**
 * File detection utilities for auto-selecting files from prompt text
 */

/**
 * Extract path-like candidates from text
 * Matches patterns like "src/services/tool_dispatcher.py"
 * @param {string} text - The text to search for paths
 * @returns {string[]} - Array of unique path candidates
 */
export function extractPathCandidates(text) {
    if (!text) return [];
    
    console.log('[FileDetect] Extracting from text:', text.substring(0, 200) + '...');
    
    const matches = new Set();
    
    // Pattern 1: Full paths with directories and extensions
    // Examples: src/utils/helper.js, path/to/file.py, components/Button.tsx
    const fullPathPattern = /([A-Za-z0-9_\-.]+\/)+[A-Za-z0-9_\-.]+\.[A-Za-z0-9]+/g;
    
    // Pattern 2: Standalone filenames with extensions (no path required)
    // Examples: config.json, main.py, index.js, README.md
    const filenamePattern = /\b[A-Za-z0-9_\-]+\.(js|ts|py|java|cpp|c|h|css|html|json|xml|md|txt|jsx|tsx|vue|rb|go|rs|php|yml|yaml|toml|ini|sh|bash|sql)\b/gi;
    
    // Pattern 3: Quoted paths or filenames
    const quotedPattern = /["'`]([A-Za-z0-9_\-.\/]+(?:\.[A-Za-z0-9]+)?)["`']/g;
    
    // Pattern 4: "File:" or "file:" format
    const filePattern = /\b(?:File|file):\s*([A-Za-z0-9_\-.\/]+(?:\.[A-Za-z0-9]+)?)/g;
    
    // Pattern 5: Common file references in natural language
    // Examples: "in config.json", "the main.py file", "update app.js"
    const naturalPattern = /\b(?:in|the|update|edit|modify|check|open|see|file|from)\s+([A-Za-z0-9_\-]+\.[A-Za-z0-9]+)\b/gi;
    
    // Get full path matches
    const fullPathMatches = text.match(fullPathPattern) || [];
    console.log('[FileDetect] Full path matches:', fullPathMatches);
    fullPathMatches.forEach(match => matches.add(match));
    
    // Get standalone filename matches
    const filenameMatches = text.match(filenamePattern) || [];
    console.log('[FileDetect] Filename matches:', filenameMatches);
    filenameMatches.forEach(match => matches.add(match));
    
    // Get quoted matches
    let quotedMatch;
    while ((quotedMatch = quotedPattern.exec(text)) !== null) {
        const path = quotedMatch[1];
        // Add if it looks like a file (has extension or is a known filename)
        if (/\.[A-Za-z0-9]+$/.test(path) || /^(package|tsconfig|webpack\.config|babel\.config|jest\.config)/.test(path)) {
            matches.add(path);
        }
    }
    
    // Get "File:" format matches
    let fileMatch;
    while ((fileMatch = filePattern.exec(text)) !== null) {
        matches.add(fileMatch[1]);
    }
    
    // Get natural language matches
    let naturalMatch;
    while ((naturalMatch = naturalPattern.exec(text)) !== null) {
        matches.add(naturalMatch[1]);
    }
    
    const result = Array.from(matches);
    console.log('[FileDetect] Total candidates found:', result);
    return result;
}

/**
 * Create a fuzzy path matcher using Fuse.js
 * @param {string[]} paths - Array of file paths to search through
 * @returns {Fuse} - Configured Fuse instance
 */
export function createPathMatcher(paths) {
    // Check if Fuse is available globally (loaded via CDN)
    if (typeof Fuse === 'undefined') {
        console.error('[FileDetect] Fuse.js not available');
        return null;
    }
    
    // Prepare data with both full path and filename for weighted search
    const searchData = paths.map(path => ({
        full: path,
        filename: path.split('/').pop() || path
    }));
    
    // Configure Fuse with weighted search
    // Filename matches are weighted higher than full path matches
    return new Fuse(searchData, {
        keys: [
            { name: 'full', weight: 1 },
            { name: 'filename', weight: 2 }
        ],
        threshold: 0.3, // 70% similarity required
        includeScore: true,
        shouldSort: true
    });
}

/**
 * Find the best matching path for a candidate
 * @param {string} candidate - The path to search for
 * @param {Object} fileMap - Map of paths to file objects
 * @param {Fuse} fuzzyMatcher - Optional pre-built Fuse instance
 * @returns {Object|null} - { path: string, matchType: 'exact'|'case'|'fuzzy', score?: number }
 */
export function findBestMatch(candidate, fileMap, fuzzyMatcher = null) {
    if (!candidate || !fileMap) return null;
    
    // 1. Try exact match
    if (fileMap.hasOwnProperty(candidate)) {
        return { path: candidate, matchType: 'exact' };
    }
    
    // 2. Try case-insensitive match
    const lowerCandidate = candidate.toLowerCase();
    for (const path in fileMap) {
        if (path.toLowerCase() === lowerCandidate) {
            return { path, matchType: 'case' };
        }
    }
    
    // 3. Try fuzzy match if matcher provided
    if (fuzzyMatcher) {
        const results = fuzzyMatcher.search(candidate);
        if (results.length > 0 && results[0].score < 0.3) {
            return {
                path: results[0].item.full,
                matchType: 'fuzzy',
                score: results[0].score
            };
        }
    }
    
    return null;
}

/**
 * Process multiple path candidates and categorize matches
 * @param {string[]} candidates - Array of path candidates
 * @param {Object} fileMap - Map of paths to file objects
 * @param {Fuse} fuzzyMatcher - Optional Fuse instance for fuzzy matching
 * @returns {Object} - { exact: [], fuzzy: [], unmatched: [] }
 */
export function categorizeMatches(candidates, fileMap, fuzzyMatcher = null) {
    const result = {
        exact: [],      // Exact or case-insensitive matches
        fuzzy: [],      // Fuzzy matches with scores
        unmatched: []   // No matches found
    };
    
    for (const candidate of candidates) {
        const match = findBestMatch(candidate, fileMap, fuzzyMatcher);
        
        if (!match) {
            result.unmatched.push(candidate);
        } else if (match.matchType === 'fuzzy') {
            result.fuzzy.push({
                original: candidate,
                matched: match.path,
                score: match.score
            });
        } else {
            result.exact.push(match.path);
        }
    }
    
    return result;
}