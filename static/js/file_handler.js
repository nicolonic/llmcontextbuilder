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
        content += '<>\n';
        for (const [path, fileContent] of this.selectedFiles) {
            content += `File: ${path}\n\`\`\`\n${fileContent}\`\`\`\n\n`;
        }
        content += '</>';
        return content;
    }

    getFinalContent(prompt) {
        return `${prompt}\n\nFiles: ${this.getAggregatedContent()}`;
    }

    getSelectedFiles() {
        return Array.from(this.selectedFiles.keys());
    }
}