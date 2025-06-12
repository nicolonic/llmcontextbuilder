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
    
    // Pattern matches: one or more directory segments followed by filename.extension
    // Examples: src/utils/helper.js, path/to/file.py, components/Button.tsx
    const pattern = /([A-Za-z0-9_\-.]+\/)+[A-Za-z0-9_\-.]+\.[A-Za-z0-9]+/g;
    
    // Also try to match paths that might be wrapped in quotes or backticks
    const quotedPattern = /["'`]([^"'`]+\.[A-Za-z0-9]+)["'`]/g;
    
    const matches = new Set();
    
    // Get regular path matches
    const regularMatches = text.match(pattern) || [];
    regularMatches.forEach(match => matches.add(match));
    
    // Get quoted path matches
    let quotedMatch;
    while ((quotedMatch = quotedPattern.exec(text)) !== null) {
        // If it looks like a path (has at least one slash or common extensions)
        const path = quotedMatch[1];
        if (path.includes('/') || /\.(js|ts|py|java|cpp|c|h|css|html|json|xml|md|txt)$/i.test(path)) {
            matches.add(path);
        }
    }
    
    return Array.from(matches);
}

/**
 * Create a fuzzy path matcher using Fuse.js
 * @param {string[]} paths - Array of file paths to search through
 * @returns {Fuse} - Configured Fuse instance
 */
export function createPathMatcher(paths) {
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