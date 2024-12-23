class UIController {
    constructor() {
        this.fileHandler = new FileHandler();
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        this.selectFolderBtn = document.getElementById('selectFolderBtn');
        this.directoryTree = document.getElementById('directoryTree');
        this.selectedFiles = document.getElementById('selectedFiles');
        this.outputArea = document.getElementById('outputArea');
        this.copyBtn = document.getElementById('copyBtn');
    }

    attachEventListeners() {
        this.selectFolderBtn.addEventListener('click', () => this.handleFolderSelect());
        this.copyBtn.addEventListener('click', () => this.copyToClipboard());
    }

    async handleFolderSelect() {
        const path = prompt('Enter the folder path:');
        if (path) {
            try {
                await this.loadDirectory(path);
            } catch (error) {
                this.showToast(`Error: ${error.message}`, true);
            }
        }
    }

    async loadDirectory(path) {
        try {
            const items = await this.fileHandler.listDirectory(path);
            this.renderDirectoryTree(items);
        } catch (error) {
            this.showToast(`Failed to load directory: ${error.message}`, true);
        }
    }

    renderDirectoryTree(items) {
        this.directoryTree.innerHTML = '';
        items.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name);
        }).forEach(item => {
            const element = document.createElement('div');
            element.className = 'directory-item';
            element.innerHTML = `
                <i class="bi ${item.type === 'directory' ? 'bi-folder' : 'bi-file-text'}"></i>
                <span>${item.name}</span>
            `;
            if (item.type === 'directory') {
                element.addEventListener('click', () => this.loadDirectory(item.path));
            } else {
                element.addEventListener('dblclick', () => this.handleFileSelect(item.path));
            }
            this.directoryTree.appendChild(element);
        });
    }

    async handleFileSelect(path) {
        try {
            const content = await this.fileHandler.toggleFileSelection(path);
            this.updateSelectedFiles();
            this.outputArea.value = content;
        } catch (error) {
            this.showToast(`Error selecting file: ${error.message}`, true);
        }
    }

    updateSelectedFiles() {
        const files = this.fileHandler.getSelectedFiles();
        this.selectedFiles.innerHTML = files.map(path => `
            <div class="selected-file">
                <i class="bi bi-file-text"></i>
                <span>${path.split('/').pop()}</span>
                <button class="btn btn-sm btn-danger" onclick="ui.removeFile('${path}')">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        `).join('');
    }

    async removeFile(path) {
        await this.fileHandler.toggleFileSelection(path);
        this.updateSelectedFiles();
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