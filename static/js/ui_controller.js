class UIController {
    constructor() {
        this.fileHandler = new FileHandler();
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        this.folderInput = document.getElementById('folderInput');
        this.directoryTree = document.getElementById('directoryTree');
        this.selectedFiles = document.getElementById('selectedFiles');
        this.outputArea = document.getElementById('outputArea');
        this.copyBtn = document.getElementById('copyBtn');
        this.promptInput = document.getElementById('promptInput');
    }

    attachEventListeners() {
        this.folderInput.addEventListener('change', (e) => this.handleFolderSelect(e));
        this.copyBtn.addEventListener('click', () => this.copyToClipboard());
        this.promptInput.addEventListener('input', () => this.updateOutput());
    }

    async handleFolderSelect(event) {
        const files = Array.from(event.target.files);
        if (files.length > 0) {
            try {
                const rootPath = this.getRootPath(files[0]);
                const fileTree = this.buildFileTree(files, rootPath);
                this.renderDirectoryTree(fileTree, this.directoryTree);
            } catch (error) {
                this.showToast(`Error: ${error.message}`, true);
            }
        }
    }

    getRootPath(file) {
        const parts = file.webkitRelativePath.split('/');
        return parts[0];
    }

    buildFileTree(files, rootPath) {
        const tree = {
            name: rootPath,
            type: 'directory',
            children: new Map()
        };

        files.forEach(file => {
            const parts = file.webkitRelativePath.split('/');
            let current = tree;

            // Skip the first part as it's the root directory
            for (let i = 1; i < parts.length; i++) {
                const part = parts[i];
                const isFile = i === parts.length - 1;

                if (isFile) {
                    current.children.set(part, {
                        name: part,
                        type: 'file',
                        file: file
                    });
                } else {
                    if (!current.children.has(part)) {
                        current.children.set(part, {
                            name: part,
                            type: 'directory',
                            children: new Map()
                        });
                    }
                    current = current.children.get(part);
                }
            }
        });

        return tree;
    }

    renderDirectoryTree(node, container, level = 0) {
        container.innerHTML = ''; // Clear only on root level
        const sortedItems = Array.from(node.children.values()).sort((a, b) => {
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

        sortedItems.forEach(item => {
            const element = document.createElement('div');
            element.className = 'directory-item';
            element.style.paddingLeft = `${level * 1.5}rem`;

            element.innerHTML = `
                <i class="bi ${item.type === 'directory' ? 'bi-folder' : 'bi-file-text'}"></i>
                <span>${item.name}</span>
            `;

            if (item.type === 'directory') {
                const childContainer = document.createElement('div');
                childContainer.style.display = 'none';

                element.addEventListener('click', () => {
                    const isExpanded = childContainer.style.display !== 'none';
                    childContainer.style.display = isExpanded ? 'none' : 'block';
                    element.querySelector('i').className = `bi ${isExpanded ? 'bi-folder' : 'bi-folder-open'}`;
                });

                container.appendChild(element);
                container.appendChild(childContainer);
                this.renderDirectoryTree(item, childContainer, level + 1);
            } else {
                element.addEventListener('dblclick', () => this.handleFileSelect(item.file));
                container.appendChild(element);
            }
        });
    }

    async handleFileSelect(file) {
        try {
            const content = await file.text();
            const path = file.webkitRelativePath;
            await this.fileHandler.toggleFileSelection(path, content);
            this.updateSelectedFiles();
            this.updateOutput();
        } catch (error) {
            this.showToast(`Error selecting file: ${error.message}`, true);
        }
    }

    updateSelectedFiles() {
        const files = this.fileHandler.getSelectedFiles();
        this.selectedFiles.innerHTML = files.map(path => `
            <div class="selected-file">
                <i class="bi bi-file-text"></i>
                <span>${path}</span>
                <button class="btn btn-sm btn-danger" onclick="ui.removeFile('${path}')">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        `).join('');
    }

    updateOutput() {
        const prompt = this.promptInput.value;
        this.outputArea.value = this.fileHandler.getFinalContent(prompt);
    }

    async removeFile(path) {
        await this.fileHandler.toggleFileSelection(path);
        this.updateSelectedFiles();
        this.updateOutput();
    }

    async copyToClipboard() {
        try {
            await navigator.clipboard.writeText(this.outputArea.value);
            this.showToast('Content copied to clipboard!');
        } catch (error) {
            this.showToast('Failed to copy content', true);
        }
    }

    showToast(message, isError = false) {
        const toast = document.createElement('div');
        toast.className = `toast align-items-center ${isError ? 'bg-danger' : 'bg-success'} border-0 position-fixed bottom-0 end-0 m-3`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body text-white">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        document.body.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        toast.addEventListener('hidden.bs.toast', () => toast.remove());
    }
}

// Initialize the UI controller when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.ui = new UIController();
});