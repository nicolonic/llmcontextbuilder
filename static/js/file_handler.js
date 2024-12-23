class FileHandler {
    constructor() {
        this.currentPath = '/';
        this.selectedFiles = new Map(); // path -> content
    }

    async listDirectory(path) {
        try {
            const response = await fetch('/list-directory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ path }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            return data.items;
        } catch (error) {
            console.error('Error listing directory:', error);
            throw error;
        }
    }

    async readFile(path) {
        try {
            const response = await fetch('/read-file', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ path }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            return data.content;
        } catch (error) {
            console.error('Error reading file:', error);
            throw error;
        }
    }

    async toggleFileSelection(path) {
        if (this.selectedFiles.has(path)) {
            this.selectedFiles.delete(path);
        } else {
            try {
                const content = await this.readFile(path);
                this.selectedFiles.set(path, content);
            } catch (error) {
                throw error;
            }
        }
        return this.getAggregatedContent();
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