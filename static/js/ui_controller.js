class UIController {
    constructor(fileWorker) {
        this.fileHandler = new FileHandler();
        this.fileMap = {};
        this.fileWorker = fileWorker;
        this.pendingFileReads = new Map(); // Track pending file reads
        this.lazyLoadEnabled = true; // Enable lazy loading by default
        this.initializeElements();
        this.attachEventListeners();
        this.setupWorkerHandlers();
    }

    initializeElements() {
        this.folderInput = document.getElementById('folderInput');
        this.directoryTree = document.getElementById('directoryTree');
        this.selectedFiles = document.getElementById('selectedFiles');
        this.outputArea = document.getElementById('outputArea');
        this.copyBtn = document.getElementById('copyBtn');
        this.promptInput = document.getElementById('promptInput');
        this.selectAllBtn = document.getElementById('selectAllBtn');
        this.clearSelectionBtn = document.getElementById('clearSelectionBtn');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.refreshStaleBtn = document.getElementById('refreshStaleBtn');
        this.treeSearch = document.getElementById('treeSearch');
        this.charCount = document.getElementById('charCount');
        this.tokenCount = document.getElementById('tokenCount');
        this.ignoreRulesBtn = document.getElementById('ignoreRulesBtn');
        this.ignoreModal = new bootstrap.Modal(document.getElementById('ignoreModal'));
        this.ignoreRulesTextarea = document.getElementById('ignoreRulesTextarea');
        this.saveIgnoreRulesBtn = document.getElementById('saveIgnoreRules');
        this.exportMarkdown = document.getElementById('exportMarkdown');
        this.exportHTML = document.getElementById('exportHTML');
        this.exportJSON = document.getElementById('exportJSON');
        this.presetSelect = document.getElementById('presetSelect');
        this.generatePromptBtn = document.getElementById('generatePromptBtn');
        this.loadIgnoreRules();
        this.initializePresets();
        this.startAutoRefresh();
        this.initializeCodeMirror();
    }

    attachEventListeners() {
        this.folderInput.addEventListener('change', (e) => this.handleFolderSelect(e));
        this.copyBtn.addEventListener('click', () => this.copyToClipboard());
        this.promptInput.addEventListener('input', () => this.updateOutput());
        this.selectAllBtn.addEventListener('click', () => this.selectAllFiles());
        this.clearSelectionBtn.addEventListener('click', () => this.clearSelection());
        this.refreshBtn.addEventListener('click', () => this.refreshSelectedFiles());
        this.refreshStaleBtn.addEventListener('click', () => this.refreshStaleFiles());
        this.treeSearch.addEventListener('input', (e) => this.filterTree(e.target.value));
        this.ignoreRulesBtn.addEventListener('click', () => this.ignoreModal.show());
        this.saveIgnoreRulesBtn.addEventListener('click', () => this.saveIgnoreRules());
        this.exportMarkdown.addEventListener('click', () => this.exportAs('markdown'));
        this.exportHTML.addEventListener('click', () => this.exportAs('html'));
        this.exportJSON.addEventListener('click', () => this.exportAs('json'));
        this.presetSelect.addEventListener('change', (e) => this.applyPreset(e.target.value));
        this.generatePromptBtn.addEventListener('click', () => this.generatePrompt());
        
        // Hotkeys
        document.addEventListener('keydown', (e) => {
            if (e.metaKey || e.ctrlKey) {
                if (e.key === 'a') {
                    e.preventDefault();
                    this.selectAllFiles();
                }
                if (e.key === 'f') {
                    e.preventDefault();
                    this.treeSearch.focus();
                }
            }
        });
    }

    setupWorkerHandlers() {
        if (!this.fileWorker) return;
        
        this.fileWorker.onmessage = (event) => {
            const { type, ...data } = event.data;
            
            switch(type) {
                case 'FILE_CONTENT':
                    this.handleFileContent(data);
                    break;
                    
                case 'BATCH_COMPLETE':
                    this.handleBatchComplete(data);
                    break;
                    
                case 'BATCH_PROGRESS':
                    this.handleBatchProgress(data);
                    break;
                    
                case 'ERROR':
                    this.handleWorkerError(data);
                    break;
            }
        };
    }

    handleFileContent(data) {
        const { path, text, id } = data;
        
        // Check if this was a lazy load
        const wasLazyLoad = this.fileHandler.pendingFiles.has(path);
        
        // Mark file as loaded with content
        this.fileHandler.markFileLoaded(path, text);
        
        // Update metadata if available
        if (data.metadata) {
            const existingMeta = this.fileHandler.metadata.get(path) || {};
            this.fileHandler.metadata.set(path, {
                ...existingMeta,
                mtime: data.metadata.lastModified,
                size: data.metadata.size,
                hash: this.fileHandler.simpleHash(text),
                loaded: true
            });
        }
        
        // Resolve any pending promise
        const pending = this.pendingFileReads.get(id);
        if (pending) {
            pending.resolve({ path, text });
            this.pendingFileReads.delete(id);
        }
        
        // Update UI
        this.updateSelectedFiles();
        this.updateOutput();
        
        // Show success message for lazy loads
        if (wasLazyLoad) {
            this.showToast(`Loaded: ${path.split('/').pop()}`);
        }
    }

    handleBatchComplete(data) {
        const { batchId, results, errors } = data;
        
        // Process successful results
        results.forEach(result => {
            this.fileHandler.selectedFiles.set(result.path, result.text);
            if (result.metadata) {
                this.fileHandler.metadata.set(result.path, {
                    mtime: result.metadata.lastModified,
                    size: result.metadata.size,
                    hash: this.fileHandler.simpleHash(result.text)
                });
            }
        });
        
        // Log errors
        if (errors.length > 0) {
            console.error('Batch read errors:', errors);
            this.showToast(`Failed to read ${errors.length} files`, true);
        }
        
        // Update UI
        this.updateSelectedFiles();
        this.updateOutput();
        
        if (results.length > 0) {
            this.showToast(`Loaded ${results.length} files`);
        }
    }

    handleBatchProgress(data) {
        const { processed, total } = data;
        // Could update a progress bar here
        console.log(`File loading progress: ${processed}/${total}`);
    }

    handleWorkerError(data) {
        const { path, error } = data;
        console.error(`Worker error for ${path}:`, error);
        this.showToast(`Error reading ${path}: ${error}`, true);
    }

    async handleFolderSelect(event) {
        const rawFiles = Array.from(event.target.files);
        // Filter out ignored files/folders
        const files = rawFiles.filter(f => !this.shouldIgnore(f.webkitRelativePath));
        if (files.length === 0) {
            this.showToast('No relevant files after filtering ignore patterns', true);
            return;
        }
        if (files.length > 0) {
            try {
                // Reset mappings each time a new folder is selected
                this.fileMap = {};
                this.allFiles = files; // store filtered list
                const rootPath = this.getRootPath(files[0]);
                const fileTree = this.buildFileTree(files, rootPath);
                this.renderDirectoryTree(fileTree, this.directoryTree);
                // After reload, optionally refresh previously selected files content
                await this.refreshSelectedFiles();
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
                    this.fileMap[file.webkitRelativePath] = file;
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

            let innerHTML = `
                <i class="bi ${item.type === 'directory' ? 'bi-folder' : 'bi-file-text'}"></i>
                <span>${item.name}</span>
            `;
            
            if (item.type === 'file' && item.file) {
                const kb = (item.file.size / 1024).toFixed(1);
                innerHTML += `<span class="badge text-bg-secondary ms-auto">${kb} KB</span>`;
            }
            
            element.innerHTML = innerHTML;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input me-2';
            element.prepend(checkbox);

            if (item.type === 'directory') {
                const childContainer = document.createElement('div');
                childContainer.style.display = 'none';

                checkbox.addEventListener('change', (e) => {
                    this.toggleDirectorySelection(item, e.target.checked);
                });

                element.addEventListener('click', () => {
                    const isExpanded = childContainer.style.display !== 'none';
                    childContainer.style.display = isExpanded ? 'none' : 'block';
                    element.querySelector('i').className = `bi ${isExpanded ? 'bi-folder' : 'bi-folder-open'}`;
                });

                container.appendChild(element);
                container.appendChild(childContainer);
                this.renderDirectoryTree(item, childContainer, level + 1);
            } else {
                checkbox.addEventListener('change', async (e) => {
                    if (e.target.checked) {
                        await this.handleFileSelect(item.file);
                    } else {
                        await this.fileHandler.toggleFileSelection(item.file.webkitRelativePath, null, item.file);
                        this.updateSelectedFiles();
                        this.updateOutput();
                    }
                });
                element.querySelector('span').addEventListener('dblclick', () => this.handleFileSelect(item.file));
                container.appendChild(element);
            }
        });
    }

    async handleFileSelect(file) {
        const path = file.webkitRelativePath;
        
        // Check if already selected (toggle off)
        if (this.fileHandler.selectedFiles.has(path)) {
            this.fileHandler.selectedFiles.delete(path);
            this.fileHandler.metadata.delete(path);
            this.updateFileCheckbox(path, false);
            this.updateSelectedFiles();
            this.updateOutput();
            return;
        }
        
        // Use worker to read file asynchronously
        if (this.fileWorker) {
            const id = `${path}_${Date.now()}`;
            
            // Send to worker
            this.fileWorker.postMessage({
                type: 'READ',
                data: { file, path, id }
            });
            
            // Update checkbox immediately for better UX
            this.updateFileCheckbox(path, true);
            
            // Show loading indicator
            this.showToast(`Loading ${file.name}...`);
        } else {
            // Fallback to sync read if no worker
            try {
                const content = await file.text();
                await this.fileHandler.toggleFileSelection(path, content, file);
                this.updateFileCheckbox(path, true);
                this.updateSelectedFiles();
                this.updateOutput();
            } catch (error) {
                this.showToast(`Error selecting file: ${error.message}`, true);
            }
        }
    }

    updateSelectedFiles() {
        const allPaths = this.fileHandler.getAllSelectedPaths();
        this.selectedFiles.innerHTML = allPaths.map((path, index) => {
            const isLoaded = this.fileHandler.isFileLoaded(path);
            const meta = this.fileHandler.metadata.get(path);
            const sizeKB = meta ? (meta.size / 1024).toFixed(1) : '?';
            
            return `
            <div class="selected-file ${!isLoaded ? 'pending' : ''}" data-path="${path}">
                <i class="bi ${isLoaded ? 'bi-file-text' : 'bi-file-earmark'}"></i>
                <span>${path}</span>
                <span class="badge text-bg-${isLoaded ? 'success' : 'warning'} ms-2">
                    ${isLoaded ? sizeKB + ' KB' : 'Pending'}
                </span>
                <div class="btn-group btn-group-sm">
                    ${!isLoaded ? 
                        `<button class="btn btn-outline-success" onclick="ui.loadFileContent('${path}')" title="Load content">
                            <i class="bi bi-download"></i>
                        </button>` : 
                        `<button class="btn btn-outline-primary" onclick="ui.summarizeFile('${path}')" title="Summarize">
                            <i class="bi bi-card-text"></i>
                        </button>`
                    }
                    <button class="btn btn-danger" onclick="ui.removeFile('${path}')">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
            </div>
        `}).join('');
    }

    updateOutput() {
        const prompt = this.promptInput.value;
        const content = this.fileHandler.getFinalContent(prompt);
        if (this.editor) {
            this.editor.setValue(content);
        } else {
            this.outputArea.value = content;
        }
        this.updateCounts(content);
    }

    async removeFile(path) {
        await this.fileHandler.toggleFileSelection(path);
        this.updateSelectedFiles();
        this.updateOutput();
    }

    async copyToClipboard() {
        try {
            const content = this.editor ? this.editor.getValue() : this.outputArea.value;
            await navigator.clipboard.writeText(content);
            this.showToast('Content copied to clipboard!');
        } catch (error) {
            this.showToast('Failed to copy content', true);
        }
    }

    async selectAllFiles() {
        if (!this.allFiles || this.allFiles.length === 0) {
            this.showToast('No files loaded to select', true);
            return;
        }
        
        // Filter out already selected files
        const filesToLoad = this.allFiles.filter(file => 
            !this.fileHandler.selectedFiles.has(file.webkitRelativePath)
        );
        
        if (filesToLoad.length === 0) {
            this.showToast('All files already selected!');
            return;
        }
        
        // Update all checkboxes immediately
        this.updateAllCheckboxes(true);
        
        if (this.fileWorker) {
            // Use worker for batch processing
            const batchId = `batch_${Date.now()}`;
            const fileData = filesToLoad.map(file => ({
                file,
                path: file.webkitRelativePath
            }));
            
            this.showToast(`Loading ${filesToLoad.length} files...`);
            
            this.fileWorker.postMessage({
                type: 'READ_BATCH',
                data: { files: fileData, batchId }
            });
        } else {
            // Fallback to sequential processing with concurrency limit
            try {
                const CONCURRENT_LIMIT = 10;
                const pool = this.createConcurrentPool(CONCURRENT_LIMIT);
                
                const tasks = filesToLoad.map(file => async () => {
                    const path = file.webkitRelativePath;
                    const content = await file.text();
                    await this.fileHandler.toggleFileSelection(path, content, file);
                });
                
                await pool(tasks);
                
                this.updateSelectedFiles();
                this.updateOutput();
                this.showToast('All files selected!');
            } catch (error) {
                this.showToast(`Error selecting all files: ${error.message}`, true);
            }
        }
    }

    clearSelection() {
        this.fileHandler.selectedFiles.clear();
        // Update all checkboxes to unchecked state
        this.updateAllCheckboxes(false);
        this.updateSelectedFiles();
        this.updateOutput();
        this.showToast('Selection cleared');
    }

    async toggleDirectorySelection(dirItem, isChecked) {
        const filesToProcess = [];
        const allPaths = [];
        
        const traverse = (item) => {
            if (item.type === 'file') {
                const path = item.file.webkitRelativePath;
                allPaths.push(path);
                
                if (isChecked && !this.fileHandler.selectedFiles.has(path)) {
                    filesToProcess.push({ file: item.file, path });
                } else if (!isChecked && this.fileHandler.selectedFiles.has(path)) {
                    // Remove from selection
                    this.fileHandler.selectedFiles.delete(path);
                    this.fileHandler.metadata.delete(path);
                }
            } else if (item.children) {
                item.children.forEach(child => traverse(child));
            }
        };
        
        traverse(dirItem);
        
        // Update all checkboxes immediately
        allPaths.forEach(path => {
            this.updateFileCheckbox(path, isChecked);
        });
        
        if (isChecked && filesToProcess.length > 0) {
            if (this.fileWorker) {
                // Use worker for batch processing
                const batchId = `dir_${Date.now()}`;
                this.showToast(`Loading ${filesToProcess.length} files from directory...`);
                
                this.fileWorker.postMessage({
                    type: 'READ_BATCH',
                    data: { files: filesToProcess, batchId }
                });
            } else {
                // Fallback with concurrency limit
                const pool = this.createConcurrentPool(10);
                const tasks = filesToProcess.map(({ file, path }) => async () => {
                    const content = await file.text();
                    await this.fileHandler.toggleFileSelection(path, content, file);
                });
                
                await pool(tasks);
                this.updateSelectedFiles();
                this.updateOutput();
            }
        } else {
            // Just deselecting, update UI
            this.updateSelectedFiles();
            this.updateOutput();
        }
    }

    async refreshSelectedFiles() {
        if (!this.fileMap || Object.keys(this.fileMap).length === 0) {
            this.showToast('No folder loaded to refresh', true);
            return;
        }
        try {
            const refreshPromises = [];
            for (const [path] of this.fileHandler.selectedFiles) {
                if (this.fileMap[path]) {
                    refreshPromises.push(this.fileMap[path].text().then(content => {
                        this.fileHandler.selectedFiles.set(path, content);
                    }));
                }
            }
            await Promise.all(refreshPromises);
            this.updateOutput();
            this.showToast('Selected file contents refreshed!');
        } catch (error) {
            this.showToast(`Error refreshing files: ${error.message}`, true);
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

    shouldIgnore(path) {
        const lowerPath = path.toLowerCase();

        // Use custom ignore rules if available
        if (this.ignoreRules && this.ignoreRules.length > 0) {
            for (const rule of this.ignoreRules) {
                if (this.matchesGlob(path, rule)) return true;
            }
        }

        // Default directory patterns to ignore
        const ignoreDirs = [
            '/.git/', '/.svn/', '/.vscode/', '/.idea/', '/node_modules/', '/venv/', '/.venv/', '/build/', '/dist/', '/out/', '/.next/', '/coverage/', '/.pytest_cache/'
        ];
        for (const dir of ignoreDirs) {
            if (lowerPath.includes(dir)) return true;
        }

        // Specific filenames to ignore
        const ignoreFiles = ['.gitignore', '.npmrc', '.prettierrc', '.eslintrc', '.babelrc'];
        const fileName = lowerPath.split('/').pop();
        if (ignoreFiles.includes(fileName)) return true;

        // Extensions to ignore
        const ignoreExts = ['.log', '.json', '.pyc', '.pyo', '.pyd', '.class'];
        for (const ext of ignoreExts) {
            if (fileName.endsWith(ext)) return true;
        }
        return false;
    }

    filterTree(query) {
        if (!query) {
            // Show all items
            document.querySelectorAll('.directory-item').forEach(el => {
                el.style.display = '';
            });
            return;
        }

        // Build search index from fileMap
        const searchableItems = Object.keys(this.fileMap).map(path => ({
            path,
            name: path.split('/').pop()
        }));

        // Use Fuse.js for fuzzy search
        const fuse = new Fuse(searchableItems, {
            keys: ['name', 'path'],
            threshold: 0.3
        });

        const results = fuse.search(query);
        const matchedPaths = new Set(results.map(r => r.item.path));

        // Hide/show items based on search
        document.querySelectorAll('.directory-item').forEach(el => {
            const itemText = el.querySelector('span').textContent;
            const isMatch = Array.from(matchedPaths).some(path => path.includes(itemText));
            el.style.display = isMatch ? '' : 'none';
        });
    }

    updateCounts(content) {
        const charCount = content.length;
        const tokenCount = this.estimateTokens(content);
        this.charCount.textContent = charCount.toLocaleString();
        this.tokenCount.textContent = tokenCount.toLocaleString();
    }

    estimateTokens(text) {
        // Simple estimation: ~4 characters per token on average
        return Math.ceil(text.length / 4);
    }

    loadIgnoreRules() {
        const savedRules = localStorage.getItem('ignoreRules');
        if (savedRules) {
            this.ignoreRules = JSON.parse(savedRules);
            this.ignoreRulesTextarea.value = this.ignoreRules.join('\n');
        } else {
            // Set default ignore rules
            this.ignoreRules = [
                // Log files
                '*.log',
                // Binary/compiled files
                '*.pyc',
                '*.pyo', 
                '*.pyd',
                '*.class',
                // Config files that are usually noise
                '.gitignore',
                '*.json',
                '.npmrc',
                '.prettierrc',
                '.eslintrc',
                '.babelrc',
                // Directories
                '.git/*',
                '.svn/*',
                '.vscode/*',
                '.idea/*',
                'node_modules/*',
                'venv/*',
                '.venv/*',
                'build/*',
                'dist/*',
                'out/*',
                '.next/*',
                'coverage/*',
                '.pytest_cache/*'
            ];
            this.ignoreRulesTextarea.value = this.ignoreRules.join('\n');
            // Auto-save the defaults
            localStorage.setItem('ignoreRules', JSON.stringify(this.ignoreRules));
        }
    }

    saveIgnoreRules() {
        const rulesText = this.ignoreRulesTextarea.value;
        this.ignoreRules = rulesText.split('\n').filter(rule => rule.trim());
        localStorage.setItem('ignoreRules', JSON.stringify(this.ignoreRules));
        this.ignoreModal.hide();
        this.showToast('Ignore rules saved!');
    }

    matchesGlob(path, pattern) {
        // Simple glob matching
        const regex = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        return new RegExp(regex).test(path);
    }

    exportAs(format) {
        const content = this.editor ? this.editor.getValue() : this.outputArea.value;
        const prompt = this.promptInput.value;
        let data, mimeType, filename;

        switch(format) {
            case 'markdown':
                data = content;
                mimeType = 'text/markdown';
                filename = 'aggregated-content.md';
                break;
            case 'html':
                data = this.convertToHTML(content);
                mimeType = 'text/html';
                filename = 'aggregated-content.html';
                break;
            case 'json':
                data = JSON.stringify({
                    prompt: prompt,
                    files: Array.from(this.fileHandler.selectedFiles.entries()).map(([path, content]) => ({
                        path,
                        content
                    }))
                }, null, 2);
                mimeType = 'application/json';
                filename = 'aggregated-content.json';
                break;
        }

        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast(`Exported as ${format}!`);
    }

    convertToHTML(markdown) {
        // Basic markdown to HTML conversion
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Aggregated Content</title>
    <style>
        body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        pre { background: #f4f4f4; padding: 10px; overflow-x: auto; }
        code { background: #f4f4f4; padding: 2px 4px; }
    </style>
</head>
<body>
<pre>${markdown.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;
    }

    initializePresets() {
        this.presets = {
            'source-code': {
                include: ['*.js', '*.jsx', '*.ts', '*.tsx', '*.py', '*.java', '*.cpp', '*.c', '*.h', '*.cs', '*.go', '*.rs', '*.rb', '*.php'],
                exclude: ['*.min.js', '*.bundle.js', 'dist/*', 'build/*']
            },
            'python': {
                include: ['*.py', '*.pyw', '*.pyx', '*.pyi'],
                exclude: ['__pycache__/*', '*.pyc']
            },
            'javascript': {
                include: ['*.js', '*.jsx', '*.ts', '*.tsx', '*.mjs'],
                exclude: ['node_modules/*', '*.min.js', 'dist/*']
            },
            'documentation': {
                include: ['*.md', '*.rst', '*.txt', 'README*', 'LICENSE*', '*.adoc'],
                exclude: []
            },
            'config': {
                include: ['*.json', '*.yaml', '*.yml', '*.toml', '*.ini', '*.cfg', '.env*', '.*rc'],
                exclude: ['package-lock.json', 'yarn.lock']
            }
        };
    }

    async applyPreset(presetName) {
        if (!presetName || !this.presets[presetName]) {
            return;
        }

        const preset = this.presets[presetName];
        
        // Clear current selection
        this.clearSelection();

        // Apply preset patterns
        if (this.allFiles) {
            const promises = [];
            const pathsToCheck = [];
            
            for (const file of this.allFiles) {
                const path = file.webkitRelativePath;
                const shouldInclude = preset.include.some(pattern => this.matchesGlob(path, pattern));
                const shouldExclude = preset.exclude.some(pattern => this.matchesGlob(path, pattern));
                
                if (shouldInclude && !shouldExclude) {
                    pathsToCheck.push(path);
                    if (!this.fileHandler.selectedFiles.has(path)) {
                        promises.push(file.text().then(content => {
                            return this.fileHandler.toggleFileSelection(path, content, file);
                        }));
                    }
                }
            }
            
            // Wait for all file reads to complete
            await Promise.all(promises);
            
            // Update all relevant checkboxes
            pathsToCheck.forEach(path => {
                this.updateFileCheckbox(path, true);
            });
            
            this.updateSelectedFiles();
            this.updateOutput();
        }

        this.showToast(`Applied preset: ${presetName}`);
    }

    findCheckboxForPath(path) {
        const allItems = document.querySelectorAll('.directory-item');
        for (const item of allItems) {
            const itemText = item.querySelector('span').textContent;
            if (path.endsWith(itemText)) {
                return item.querySelector('input[type="checkbox"]');
            }
        }
        return null;
    }

    startAutoRefresh() {
        // Check for stale files every 5 seconds
        this.staleCheckInterval = setInterval(() => this.scanStaleness(), 5000);
    }

    async scanStaleness() {
        if (!this.fileMap || Object.keys(this.fileMap).length === 0) return;
        
        for (const [path, meta] of this.fileHandler.metadata) {
            const file = this.fileMap[path];
            if (file && file.lastModified > meta.mtime) {
                meta.stale = true;
                this.markTreeItemStale(path);
            }
        }
    }

    markTreeItemStale(path) {
        const allItems = document.querySelectorAll('.directory-item');
        for (const item of allItems) {
            const itemText = item.querySelector('span').textContent;
            if (path.endsWith(itemText)) {
                if (!item.querySelector('.stale-indicator')) {
                    const staleIcon = document.createElement('span');
                    staleIcon.className = 'stale-indicator text-warning ms-1';
                    staleIcon.innerHTML = '🔄';
                    staleIcon.title = 'File has been modified';
                    item.querySelector('span').appendChild(staleIcon);
                }
                break;
            }
        }
    }

    async refreshStaleFiles() {
        const staleFiles = [];
        for (const [path, meta] of this.fileHandler.metadata) {
            if (meta.stale) {
                staleFiles.push(path);
            }
        }
        
        if (staleFiles.length === 0) {
            this.showToast('No stale files to refresh');
            return;
        }

        const refreshPromises = [];
        for (const path of staleFiles) {
            const file = this.fileMap[path];
            if (file) {
                refreshPromises.push(file.text().then(content => {
                    this.fileHandler.selectedFiles.set(path, content);
                    const meta = this.fileHandler.metadata.get(path);
                    meta.mtime = file.lastModified;
                    meta.hash = this.fileHandler.simpleHash(content);
                    meta.stale = false;
                    this.removeStaleIndicator(path);
                }));
            }
        }

        await Promise.all(refreshPromises);
        this.updateOutput();
        this.showToast(`Refreshed ${staleFiles.length} stale files`);
    }

    removeStaleIndicator(path) {
        const allItems = document.querySelectorAll('.directory-item');
        for (const item of allItems) {
            const itemText = item.querySelector('span').textContent;
            if (path.endsWith(itemText)) {
                const staleIndicator = item.querySelector('.stale-indicator');
                if (staleIndicator) {
                    staleIndicator.remove();
                }
                break;
            }
        }
    }

    initializeCodeMirror() {
        // Initialize CodeMirror editor
        this.editor = CodeMirror.fromTextArea(this.outputArea, {
            mode: 'gfm',
            theme: 'dracula',
            lineNumbers: true,
            lineWrapping: true,
            readOnly: true,
            viewportMargin: Infinity
        });
        
        // Set height
        this.editor.setSize(null, 'calc(100vh - 550px)');
        
        // Update counts when editor content changes
        this.editor.on('change', () => {
            this.updateCounts(this.editor.getValue());
        });
    }

    async summarizeFile(path) {
        const content = this.fileHandler.selectedFiles.get(path);
        if (!content) return;
        
        try {
            const response = await fetch('/api/summarize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: content,
                    limit: 5
                })
            });
            
            if (!response.ok) throw new Error('Summarization failed');
            
            const data = await response.json();
            
            // Replace content with summary
            const summarizedContent = `[SUMMARIZED]\n${data.summary}\n[Original: ${data.original_length} chars → ${data.summary_length} chars]`;
            this.fileHandler.selectedFiles.set(path, summarizedContent);
            
            // Update UI
            this.updateOutput();
            this.showToast(`File summarized: ${path}`);
            
            // Add visual indicator
            const fileElement = document.querySelector(`[data-path="${path}"]`);
            if (fileElement) {
                fileElement.classList.add('text-info');
            }
        } catch (error) {
            this.showToast(`Error summarizing file: ${error.message}`, true);
        }
    }

    async generatePrompt() {
        const currentText = this.promptInput.value.trim();
        
        if (!currentText) {
            this.showToast('Please enter some text first', true);
            return;
        }
        
        // Save original text
        const originalText = currentText;
        
        // Update button state
        this.generatePromptBtn.disabled = true;
        const originalButtonHtml = this.generatePromptBtn.innerHTML;
        this.generatePromptBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Generating...';
        
        try {
            const response = await fetch('/api/generate-prompt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ input: currentText })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate prompt');
            }
            
            // Clear the prompt area
            this.promptInput.value = '';
            
            // Handle streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let generatedText = '';
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data) {
                            try {
                                const parsed = JSON.parse(data);
                                
                                if (parsed.error) {
                                    throw new Error(parsed.error);
                                }
                                
                                if (parsed.text) {
                                    generatedText += parsed.text;
                                    this.promptInput.value = generatedText;
                                    
                                    // Auto-resize textarea
                                    this.promptInput.style.height = 'auto';
                                    this.promptInput.style.height = this.promptInput.scrollHeight + 'px';
                                }
                                
                                if (parsed.done) {
                                    this.showToast('Prompt generated successfully!');
                                    this.updateOutput();
                                }
                            } catch (e) {
                                console.error('Error parsing SSE data:', e);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            this.showToast(`Error generating prompt: ${error.message}`, true);
            // Restore original text on error
            this.promptInput.value = originalText;
        } finally {
            // Restore button state
            this.generatePromptBtn.disabled = false;
            this.generatePromptBtn.innerHTML = originalButtonHtml;
        }
    }

    updateAllCheckboxes(checked) {
        const checkboxes = document.querySelectorAll('.directory-item input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
        });
    }

    updateFileCheckbox(path, checked) {
        const allItems = document.querySelectorAll('.directory-item');
        for (const item of allItems) {
            const spans = item.querySelectorAll('span');
            for (const span of spans) {
                if (path.endsWith(span.textContent)) {
                    const checkbox = item.querySelector('input[type="checkbox"]');
                    if (checkbox) {
                        checkbox.checked = checked;
                    }
                    return;
                }
            }
        }
    }

    // Utility: Concurrent execution pool
    createConcurrentPool(limit = 10) {
        return async (tasks) => {
            const results = [];
            const executing = [];
            
            for (const task of tasks) {
                const promise = Promise.resolve().then(() => task());
                results.push(promise);
                
                if (tasks.length >= limit) {
                    promise.then(() => executing.splice(executing.indexOf(promise), 1));
                    executing.push(promise);
                    
                    if (executing.length >= limit) {
                        await Promise.race(executing);
                    }
                }
            }
            
            return Promise.all(results);
        };
    }

    async loadFileContent(path) {
        const file = this.fileMap[path];
        if (!file) {
            this.showToast(`File not found: ${path}`, true);
            return;
        }
        
        if (this.fileWorker) {
            const id = `load_${path}_${Date.now()}`;
            this.fileWorker.postMessage({
                type: 'READ',
                data: { file, path, id }
            });
            this.showToast(`Loading ${file.name}...`);
        } else {
            try {
                const content = await file.text();
                this.fileHandler.markFileLoaded(path, content);
                this.updateSelectedFiles();
                this.updateOutput();
                this.showToast(`Loaded ${file.name}`);
            } catch (error) {
                this.showToast(`Error loading file: ${error.message}`, true);
            }
        }
    }
}

// Initialize the UI controller when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Don't initialize here - ui_bootstrap.js will do it with the worker
    if (!window.ui) {
        // Fallback if bootstrap didn't run
        window.ui = new UIController();
    }
});