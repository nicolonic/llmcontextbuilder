class UIController {
    constructor() {
        this.fileHandler = new FileHandler();
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        this.fileInput = document.getElementById('fileInput');
        this.extensionFilter = document.getElementById('extensionFilter');
        this.applyFilterBtn = document.getElementById('applyFilter');
        this.fileList = document.getElementById('fileList');
        this.aggregateBtn = document.getElementById('aggregateBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.outputArea = document.getElementById('outputArea');
    }

    attachEventListeners() {
        this.fileInput.addEventListener('change', () => this.handleFileSelect());
        this.applyFilterBtn.addEventListener('click', () => this.applyFilter());
        this.aggregateBtn.addEventListener('click', () => this.aggregateContent());
        this.copyBtn.addEventListener('click', () => this.copyToClipboard());
    }

    async handleFileSelect() {
        const fileNames = await this.fileHandler.handleFiles(this.fileInput.files);
        this.updateFileList(fileNames);
        this.updateButtons();
    }

    applyFilter() {
        const fileNames = this.fileHandler.setExtensionFilter(this.extensionFilter.value);
        this.updateFileList(fileNames);
        this.updateButtons();
    }

    updateFileList(fileNames) {
        this.fileList.innerHTML = '';
        fileNames.forEach(fileName => {
            const item = document.createElement('button');
            item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
            item.innerHTML = `
                <span>${fileName}</span>
                <span class="badge bg-primary rounded-pill">
                    ${(this.fileHandler.files.get(fileName).size / 1024).toFixed(2)} KB
                </span>
            `;
            item.addEventListener('click', () => this.toggleFileSelection(item, fileName));
            this.fileList.appendChild(item);
        });
    }

    toggleFileSelection(element, fileName) {
        const hasSelected = this.fileHandler.toggleFileSelection(fileName);
        element.classList.toggle('active');
        this.updateButtons(hasSelected);
    }

    async aggregateContent() {
        const content = await this.fileHandler.aggregateContent();
        this.outputArea.value = content;
        this.copyBtn.disabled = !content;
    }

    async copyToClipboard() {
        try {
            await navigator.clipboard.writeText(this.outputArea.value);
            this.showToast('Content copied to clipboard!');
        } catch (err) {
            this.showToast('Failed to copy content', true);
        }
    }

    updateButtons(hasSelected = false) {
        this.aggregateBtn.disabled = !hasSelected;
        this.copyBtn.disabled = !this.outputArea.value;
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
    new UIController();
});
