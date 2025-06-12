class FileHandler {
    constructor() {
        this.selectedFiles = new Map(); // path -> content
        this.metadata = new Map(); // path -> {mtime, size, hash, loaded}
        this.pendingFiles = new Set(); // Files selected but not yet loaded
    }

    async toggleFileSelection(path, content, file) {
        if (this.selectedFiles.has(path)) {
            this.selectedFiles.delete(path);
            this.metadata.delete(path);
        } else {
            this.selectedFiles.set(path, content);
            if (file) {
                this.metadata.set(path, {
                    mtime: file.lastModified,
                    size: file.size,
                    hash: this.simpleHash(content)
                });
            }
        }
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }

    truncateContent(content, maxLength = 1000) {
        if (content.length <= maxLength) {
            return { content, isTruncated: false };
        }
        
        // Try to truncate at a line break for cleaner display
        const truncated = content.substring(0, maxLength);
        const lastNewline = truncated.lastIndexOf('\n');
        
        if (lastNewline > maxLength * 0.8) {
            // If we found a newline reasonably close to our limit, use it
            return {
                content: content.substring(0, lastNewline),
                isTruncated: true
            };
        }
        
        // Otherwise just truncate at maxLength
        return {
            content: truncated,
            isTruncated: true
        };
    }

    getAggregatedContent() {
        // Use array join for O(n) performance instead of O(n²) string concatenation
        const parts = ['<>\n'];
        
        // Get all selected paths (both loaded and pending)
        const allPaths = this.getAllSelectedPaths();
        
        for (const path of allPaths) {
            const isLoaded = this.selectedFiles.has(path);
            const metadata = this.metadata.get(path);
            
            if (isLoaded) {
                // Show full content for loaded files (truncated if very long)
                const fileContent = this.selectedFiles.get(path);
                const truncatedContent = this.truncateContent(fileContent, 1000); // Show first 1000 chars
                
                parts.push(
                    `File: ${path}\n\`\`\`\n`,
                    truncatedContent.content,
                    truncatedContent.isTruncated ? '\n... [Content truncated in preview - full file will be included]' : '',
                    '\n\`\`\`\n\n'
                );
            } else {
                // Show placeholder for pending files
                const sizeKB = metadata ? (metadata.size / 1024).toFixed(1) : '?';
                parts.push(
                    `File: ${path}\n\`\`\`\n`,
                    `[PENDING - File not loaded yet]\n`,
                    `[Size: ${sizeKB} KB]\n`,
                    `[Click the download button or disable lazy loading to include content]\n`,
                    '\`\`\`\n\n'
                );
            }
        }
        
        parts.push('</>');
        return parts.join('');
    }

    chunkContent(content, maxChunkSize) {
        const chunks = [];
        let currentChunk = '';
        const lines = content.split('\n');
        
        for (const line of lines) {
            if (currentChunk.length + line.length + 1 > maxChunkSize && currentChunk.length > 0) {
                chunks.push(currentChunk);
                currentChunk = '';
            }
            currentChunk += line + '\n';
        }
        
        if (currentChunk) {
            chunks.push(currentChunk);
        }
        
        // Format chunks with markers
        return chunks.map((chunk, index) => 
            `<<<CHUNK ${index + 1}/${chunks.length}>>>\n${chunk}`
        ).join('\n\n');
    }

    getFinalContent(prompt, forPreview = true) {
        if (forPreview) {
            // For preview, show truncated content with placeholders
            return `${prompt}\n\nFiles: ${this.getAggregatedContent()}`;
        } else {
            // For actual export/copy, only include loaded files with full content
            return `${prompt}\n\nFiles: ${this.getFullLoadedContent()}`;
        }
    }

    getFullLoadedContent() {
        // Only include loaded files with full content (no truncation)
        const parts = ['<>\n'];
        
        for (const [path, fileContent] of this.selectedFiles) {
            parts.push(
                `File: ${path}\n\`\`\`\n`,
                fileContent,
                '\`\`\`\n\n'
            );
        }
        
        parts.push('</>');
        return parts.join('');
    }

    getSelectedFiles() {
        return Array.from(this.selectedFiles.keys());
    }

    // Add file metadata without content (for lazy loading)
    addFileMetadata(path, file) {
        this.pendingFiles.add(path);
        this.metadata.set(path, {
            mtime: file.lastModified,
            size: file.size,
            name: file.name,
            type: file.type || 'text/plain',
            loaded: false
        });
    }

    // Check if file content is loaded
    isFileLoaded(path) {
        const meta = this.metadata.get(path);
        return meta && meta.loaded;
    }

    // Mark file as loaded
    markFileLoaded(path, content) {
        this.pendingFiles.delete(path);
        this.selectedFiles.set(path, content);
        const meta = this.metadata.get(path);
        if (meta) {
            meta.loaded = true;
            meta.hash = this.simpleHash(content);
        }
    }

    // Get all files (loaded and pending)
    getAllSelectedPaths() {
        const loaded = Array.from(this.selectedFiles.keys());
        const pending = Array.from(this.pendingFiles);
        return [...new Set([...loaded, ...pending])];
    }
}