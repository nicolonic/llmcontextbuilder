class FileHandler {
    constructor() {
        this.selectedFiles = new Map(); // path -> content
    }

    async toggleFileSelection(path, content) {
        if (this.selectedFiles.has(path)) {
            this.selectedFiles.delete(path);
        } else {
            this.selectedFiles.set(path, content);
        }
    }

    getAggregatedContent() {
        let content = '';
        for (const [path, fileContent] of this.selectedFiles) {
            content += `// File: ${path}\n${fileContent}\n\n`;
        }
        return content;
    }

    getSelectedFiles() {
        return Array.from(this.selectedFiles.keys());
    }
}