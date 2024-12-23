class FileHandler {
    constructor() {
        this.files = new Map();
        this.selectedFiles = new Set();
        this.extensionFilter = new Set();
    }

    setExtensionFilter(filterString) {
        this.extensionFilter.clear();
        if (filterString.trim()) {
            const extensions = filterString.split(',')
                .map(ext => ext.trim())
                .map(ext => ext.startsWith('.') ? ext.toLowerCase() : '.' + ext.toLowerCase());
            extensions.forEach(ext => this.extensionFilter.add(ext));
        }
        return this.updateFileList();
    }

    async handleFiles(fileList) {
        this.files.clear();
        this.selectedFiles.clear();

        for (const file of fileList) {
            const extension = '.' + file.name.split('.').pop().toLowerCase();
            if (this.extensionFilter.size === 0 || this.extensionFilter.has(extension)) {
                this.files.set(file.name, file);
            }
        }

        return Array.from(this.files.keys());
    }

    updateFileList() {
        const newFiles = new Map();
        for (const [name, file] of this.files) {
            const extension = '.' + name.split('.').pop().toLowerCase();
            if (this.extensionFilter.size === 0 || this.extensionFilter.has(extension)) {
                newFiles.set(name, file);
            }
        }
        this.files = newFiles;
        this.selectedFiles = new Set(
            Array.from(this.selectedFiles).filter(name => this.files.has(name))
        );
        return Array.from(this.files.keys());
    }

    toggleFileSelection(fileName) {
        if (this.selectedFiles.has(fileName)) {
            this.selectedFiles.delete(fileName);
        } else {
            this.selectedFiles.add(fileName);
        }
        return this.selectedFiles.size > 0;
    }

    async aggregateContent() {
        let aggregatedContent = '';
        for (const fileName of this.selectedFiles) {
            const file = this.files.get(fileName);
            if (file) {
                try {
                    const content = await file.text();
                    aggregatedContent += `// File: ${fileName}\n${content}\n\n`;
                } catch (error) {
                    console.error(`Error reading file ${fileName}:`, error);
                    aggregatedContent += `// Error reading file: ${fileName}\n\n`;
                }
            }
        }
        return aggregatedContent;
    }
}
