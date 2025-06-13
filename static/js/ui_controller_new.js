// Import file detection utilities
import { extractPathCandidates, createPathMatcher, findBestMatch, categorizeMatches } from './file_detection.js';

class UIController {
    constructor(fileWorker) {
        this.fileHandler = new FileHandler();
        this.fileMap = {};
        this.fileWorker = fileWorker;
        this.pendingFileReads = new Map();
        this.lazyLoadEnabled = false; // Default to OFF for immediate loading
        this.activeTab = 'prompt';
        this.lastSelectedIndex = -1; // For shift-click selection
        
        // File detection state
        this.detectSpinner = null;
        this._fuzzyMatcher = null;
        this._detectTimeout = null;
        this._detectSpinnerTimeout = null;
        this._detectInProgress = 0; // Counter for active detections
        this.autoSelectedFiles = new Set(); // Track files selected by auto-detection
        
        this.initializeElements();
        this.attachEventListeners();
        this.setupWorkerHandlers();
        this.initializeTheme();
        this.initializeCodeMirror();
    }

    initializeElements() {
        // Header elements
        this.workspaceName = document.getElementById('workspaceName');
        this.themeToggle = document.getElementById('themeToggle');
        this.helpBtn = document.getElementById('helpBtn');
        
        
        // Explorer elements
        this.folderInput = document.getElementById('folderInput');
        this.selectFolderBtn = document.getElementById('selectFolderBtn');
        this.selectAllBtn = document.getElementById('selectAllBtn');
        this.clearSelBtn = document.getElementById('clearSelBtn');
        this.ignoreRulesBtn = document.getElementById('ignoreRulesBtn');
        this.fileSearch = document.getElementById('fileSearch');
        this.presetSelect = document.getElementById('presetSelect');
        this.explorerStats = document.getElementById('explorerStats');
        this.directoryTree = document.getElementById('directoryTree');
        
        // Tab elements
        this.tabButtons = document.querySelectorAll('.tab-btn');
        this.tabPanes = document.querySelectorAll('.tab-pane');
        
        // Prompt tab elements
        this.promptInput = document.getElementById('promptInput');
        this.promptCharCount = document.getElementById('promptCharCount');
        this.promptTokenCount = document.getElementById('promptTokenCount');
        this.generatePromptBtn = document.getElementById('generatePromptBtn');
        
        // Preview tab elements
        this.selectedFiles = document.getElementById('selectedFiles');
        this.outputArea = document.getElementById('outputArea');
        this.previewBadge = document.getElementById('previewBadge');
        
        // Batch action bar elements
        this.batchActionBar = document.getElementById('batchActionBar');
        this.batchSelectedCount = document.getElementById('batchSelectedCount');
        this.batchSummarizeBtn = document.getElementById('batchSummarizeBtn');
        this.batchDiffBtn = document.getElementById('batchDiffBtn');
        this.batchDeselectBtn = document.getElementById('batchDeselectBtn');
        
        // Footer elements
        this.previewFooter = document.getElementById('previewFooter');
        this.fileCount = document.getElementById('fileCount');
        this.totalCharCount = document.getElementById('totalCharCount');
        this.totalTokenCount = document.getElementById('totalTokenCount');
        this.refreshAllBtn = document.getElementById('refreshAllBtn');
        this.refreshStaleBtn = document.getElementById('refreshStaleBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.exportMarkdown = document.getElementById('exportMarkdown');
        this.exportHTML = document.getElementById('exportHTML');
        this.exportJSON = document.getElementById('exportJSON');
        
        // Command palette
        this.commandPalette = document.getElementById('commandPalette');
        this.commandInput = document.getElementById('commandInput');
        this.commandResults = document.getElementById('commandResults');
        
        // Modals
        this.shortcutsModal = new bootstrap.Modal(document.getElementById('shortcutsModal'));
        this.ignoreModal = new bootstrap.Modal(document.getElementById('ignoreModal'));
        this.ignoreRulesTextarea = document.getElementById('ignoreRulesTextarea');
        this.saveIgnoreRulesBtn = document.getElementById('saveIgnoreRules');
        
        this.loadIgnoreRules();
        this.initializePresets();
    }

    attachEventListeners() {
        // Header events
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.helpBtn.addEventListener('click', () => this.showShortcuts());
        
        // Explorer events
        this.selectFolderBtn.addEventListener('click', () => this.showFolderPicker());
        this.folderInput.addEventListener('change', (e) => this.handleFolderSelect(e));
        this.selectAllBtn.addEventListener('click', () => this.selectAllFiles());
        this.clearSelBtn.addEventListener('click', () => this.clearSelection());
        this.ignoreRulesBtn.addEventListener('click', () => this.ignoreModal.show());
        this.saveIgnoreRulesBtn.addEventListener('click', () => this.saveIgnoreRules());
        this.presetSelect.addEventListener('change', (e) => this.applyPreset(e.target.value));
        
        // Tab events
        this.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });
        
        // Prompt events with file detection
        this.promptInput.addEventListener('input', (e) => {
            this.updatePromptStats();
            
            // Debounced file detection
            clearTimeout(this._detectTimeout);
            this._detectTimeout = setTimeout(() => {
                this.autoDetectFiles(e.target.value);
            }, 500);
        });
        this.generatePromptBtn.addEventListener('click', () => this.generateMetaPrompt());
        
        // Batch action events
        this.batchSummarizeBtn.addEventListener('click', () => this.batchSummarize());
        this.batchDiffBtn.addEventListener('click', () => this.batchDiff());
        this.batchDeselectBtn.addEventListener('click', () => this.clearSelection());
        
        // Preview events
        this.refreshAllBtn.addEventListener('click', () => this.refreshSelectedFiles());
        this.refreshStaleBtn.addEventListener('click', () => this.refreshStaleFiles());
        this.copyBtn.addEventListener('click', () => this.copyToClipboard());
        this.exportMarkdown.addEventListener('click', () => this.exportAs('markdown'));
        this.exportHTML.addEventListener('click', () => this.exportAs('html'));
        this.exportJSON.addEventListener('click', () => this.exportAs('json'));
        
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleGlobalKeyboard(e));
        
        // Command palette
        this.fileSearch.addEventListener('focus', () => this.openCommandPalette());
        this.commandInput.addEventListener('input', (e) => this.handleCommandSearch(e.target.value));
        this.commandInput.addEventListener('keydown', (e) => this.handleCommandKeyboard(e));
        
        // Click outside to close command palette
        document.addEventListener('click', (e) => {
            if (!this.commandPalette.contains(e.target) && !this.fileSearch.contains(e.target)) {
                this.closeCommandPalette();
            }
        });
    }

    handleGlobalKeyboard(e) {
        // Cmd/Ctrl + K: Open command palette
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            this.openCommandPalette();
        }
        
        // Cmd/Ctrl + A: Select all
        if ((e.metaKey || e.ctrlKey) && e.key === 'a' && document.activeElement !== this.promptInput) {
            e.preventDefault();
            this.selectAllFiles();
        }
        
        // Cmd/Ctrl + F: Focus search
        if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
            e.preventDefault();
            this.fileSearch.focus();
        }
        
        // Cmd/Ctrl + B: Toggle explorer (on small screens)
        if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
            e.preventDefault();
            this.toggleExplorer();
        }
        
        // /: Focus search in command palette
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            if (this.commandPalette.style.display === 'block') {
                this.commandInput.focus();
            }
        }
        
        // ?: Show shortcuts
        if (e.key === '?' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            this.showShortcuts();
        }
    }

    switchTab(tabName) {
        this.activeTab = tabName;
        
        // Update tab buttons
        this.tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Update tab panes
        this.tabPanes.forEach(pane => {
            pane.style.display = pane.id === `${tabName}Tab` ? 'block' : 'none';
        });
        
        // Show/hide preview footer
        this.previewFooter.style.display = tabName === 'preview' ? 'flex' : 'none';
        
        // Hide batch action bar when in preview tab (preview footer has all controls)
        if (tabName === 'preview') {
            this.batchActionBar.style.display = 'none';
        } else {
            // Show batch action bar if files are selected
            const selectedCount = this.fileHandler.getAllSelectedPaths().length;
            if (selectedCount > 0) {
                this.batchActionBar.style.display = 'flex';
            }
        }
        
        // Update editor if needed
        if (tabName === 'preview' && this.editor) {
            setTimeout(() => this.editor.refresh(), 100);
        }
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-bs-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-bs-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        if (!this.themeToggle) return;
        const icon = this.themeToggle.querySelector('i');
        if (icon) {
            icon.className = theme === 'dark' ? 'bi bi-moon-stars' : 'bi bi-sun';
        }
    }

    showShortcuts() {
        this.shortcutsModal.show();
    }
    
    toggleExplorer() {
        const explorer = document.querySelector('.explorer-pane');
        if (window.innerWidth <= 1280) {
            explorer.classList.toggle('open');
        }
    }

    openCommandPalette() {
        this.commandPalette.style.display = 'block';
        this.commandInput.value = '';
        this.commandInput.focus();
        this.handleCommandSearch('');
    }

    closeCommandPalette() {
        this.commandPalette.style.display = 'none';
        this.commandResults.innerHTML = '';
    }

    handleCommandSearch(query) {
        if (!this.allFiles) return;
        
        let results = [];
        
        // Parse query for special tokens
        const globMatch = query.match(/glob:(\S+)/);
        const typeMatch = query.match(/type:(\S+)/);
        const sizeMatch = query.match(/size:([<>])(\d+)(kb|mb)?/i);
        
        // Filter files based on query
        let filteredFiles = this.allFiles;
        
        if (globMatch) {
            const pattern = globMatch[1];
            filteredFiles = filteredFiles.filter(file => 
                this.matchesGlob(file.webkitRelativePath, pattern)
            );
        }
        
        if (typeMatch) {
            const type = typeMatch[1].toLowerCase();
            const extensions = {
                'js': ['.js', '.jsx', '.ts', '.tsx'],
                'py': ['.py', '.pyw'],
                'css': ['.css', '.scss', '.sass'],
                'html': ['.html', '.htm'],
                'json': ['.json'],
                'md': ['.md', '.markdown']
            };
            const exts = extensions[type] || [];
            filteredFiles = filteredFiles.filter(file => 
                exts.some(ext => file.name.endsWith(ext))
            );
        }
        
        if (sizeMatch) {
            const operator = sizeMatch[1];
            const size = parseInt(sizeMatch[2]);
            const unit = (sizeMatch[3] || 'kb').toLowerCase();
            const bytes = unit === 'mb' ? size * 1024 * 1024 : size * 1024;
            
            filteredFiles = filteredFiles.filter(file => {
                return operator === '>' ? file.size > bytes : file.size < bytes;
            });
        }
        
        // Use Fuse.js for fuzzy search on the filtered files
        const cleanQuery = query.replace(/\b(glob|type|size):\S+\s*/g, '').trim();
        if (cleanQuery) {
            const fuse = new Fuse(filteredFiles, {
                keys: ['name', 'webkitRelativePath'],
                threshold: 0.3
            });
            results = fuse.search(cleanQuery).map(r => r.item);
        } else {
            results = filteredFiles;
        }
        
        // Limit results
        results = results.slice(0, 50);
        
        // Render results
        this.renderCommandResults(results);
    }

    renderCommandResults(files) {
        this.commandResults.innerHTML = files.map((file, index) => {
            const size = (file.size / 1024).toFixed(1);
            const sizeClass = this.getSizeClass(file.size);
            
            return `
                <div class="command-result-item" data-index="${index}" data-path="${file.webkitRelativePath}">
                    <i class="bi bi-file-text"></i>
                    <span class="flex-fill">${file.webkitRelativePath}</span>
                    <span class="badge ${sizeClass}">${size} KB</span>
                </div>
            `;
        }).join('');
        
        // Add click handlers
        this.commandResults.querySelectorAll('.command-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const path = item.dataset.path;
                const file = this.fileMap[path];
                if (file) {
                    this.handleFileSelect(file);
                    this.closeCommandPalette();
                }
            });
        });
    }

    handleCommandKeyboard(e) {
        if (e.key === 'Escape') {
            this.closeCommandPalette();
        }
        // Add arrow key navigation later
    }

    async handleFolderSelect(event) {
        const rawFiles = Array.from(event.target.files);
        const files = rawFiles.filter(f => !this.shouldIgnore(f.webkitRelativePath));
        
        if (files.length === 0) {
            this.showToast('No relevant files after filtering ignore patterns', true);
            return;
        }
        
        const rootPath = this.getRootPath(files[0]);
        
        // Reset state
        this.fileMap = {};
        this.allFiles = files;
        this.resetFuzzyMatcher(); // Reset file detection cache
        
        // Update UI
        this.selectAllBtn.disabled = false;
        this.clearSelBtn.disabled = false;
        this.updateExplorerStats();
        
        // Build and render tree
        const fileTree = this.buildFileTree(files, rootPath);
        this.renderDirectoryTree(fileTree, this.directoryTree);
        
        // Clear the input for next selection
        event.target.value = '';
        
        // Show success message
        this.showToast(`Loaded ${files.length} files from ${rootPath}`);
    }
    
    showFolderPicker() {
        // Prevent multiple modals
        if (document.querySelector('.folder-picker-modal')) {
            return;
        }
        
        // Show a pre-selection modal
        const preModal = document.createElement('div');
        preModal.className = 'modal fade folder-picker-modal';
        preModal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="bi bi-folder-plus"></i>
                            Select Project Folder
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="folder-picker-info">
                            <div class="info-item">
                                <i class="bi bi-info-circle text-primary"></i>
                                <div>
                                    <strong>Choose a folder</strong> containing the files you want to analyze.
                                </div>
                            </div>
                            <div class="info-item">
                                <i class="bi bi-shield-check text-success"></i>
                                <div>
                                    Files will be processed locally in your browser for analysis and aggregation. 
                                    <strong>Nothing is uploaded to any server</strong> - everything stays on your computer.
                                </div>
                            </div>
                            <div class="info-item">
                                <i class="bi bi-lightning text-warning"></i>
                                <div>
                                    You'll be able to select specific files after choosing the folder.
                                </div>
                            </div>
                            <div class="info-item">
                                <i class="bi bi-filter text-info"></i>
                                <div>
                                    Common files like <code>node_modules</code>, <code>.git</code>, and binaries are automatically filtered.
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="proceedToFolderSelect">
                            <i class="bi bi-folder2-open"></i> Choose Folder
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(preModal);
        const modal = new bootstrap.Modal(preModal);
        
        // Handle proceed button
        preModal.querySelector('#proceedToFolderSelect').addEventListener('click', () => {
            modal.hide();
            // Trigger file input after a short delay to ensure modal is fully hidden
            setTimeout(() => {
                this.folderInput.click();
            }, 300);
        });
        
        // Clean up when modal is closed or cancelled
        preModal.addEventListener('hidden.bs.modal', () => {
            // Remove the modal element after it's hidden
            setTimeout(() => {
                preModal.remove();
            }, 100);
        }, { once: true });
        
        modal.show();
    }


    updateExplorerStats() {
        const totalFiles = this.allFiles ? this.allFiles.length : 0;
        const selectedCount = this.fileHandler.getAllSelectedPaths().length;
        
        this.explorerStats.innerHTML = `
            <span>${totalFiles} files</span>
            ${selectedCount > 0 ? `<span class="text-primary">• ${selectedCount} selected</span>` : ''}
        `;
    }

    renderDirectoryTree(node, container, level = 0) {
        container.innerHTML = '';
        const sortedItems = Array.from(node.children.values()).sort((a, b) => {
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

        sortedItems.forEach((item, index) => {
            const element = document.createElement('div');
            element.className = 'directory-item';
            element.style.paddingLeft = `${level * 1.5}rem`;
            element.dataset.index = index;
            element.dataset.path = item.file ? item.file.webkitRelativePath : '';

            // Build content
            let innerHTML = `
                <i class="bi ${item.type === 'directory' ? 'bi-folder' : 'bi-file-text'}"></i>
                <span>${item.name}</span>
            `;
            
            if (item.type === 'file' && item.file) {
                innerHTML += this.getTokenHeatBar(item.file.size);
            } else if (item.type === 'directory') {
                // Add directory size info
                const sizeStr = this.formatBytes(item.totalSize);
                const fileCountStr = `${item.fileCount} ${item.fileCount === 1 ? 'file' : 'files'}`;
                const dirInfoBadge = `<span class="directory-file-count">${fileCountStr} • ${sizeStr}</span>`;
                innerHTML += dirInfoBadge + this.getDirectoryHeatBar(item.totalSize, item.fileCount);
            }
            
            element.innerHTML = innerHTML;

            // Add checkbox
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

                element.addEventListener('click', (e) => {
                    if (e.target.type !== 'checkbox') {
                        const isExpanded = childContainer.style.display !== 'none';
                        childContainer.style.display = isExpanded ? 'none' : 'block';
                        element.querySelector('i').className = `bi ${isExpanded ? 'bi-folder' : 'bi-folder-open'}`;
                        
                        // Cmd/Ctrl + Click: select directory and all contents
                        if (e.metaKey || e.ctrlKey) {
                            checkbox.checked = !checkbox.checked;
                            this.toggleDirectorySelection(item, checkbox.checked);
                        }
                    }
                });

                container.appendChild(element);
                container.appendChild(childContainer);
                this.renderDirectoryTree(item, childContainer, level + 1);
            } else {
                // File item
                checkbox.addEventListener('change', async (e) => {
                    const path = item.file.webkitRelativePath;
                    
                    if (e.target.checked) {
                        await this.handleFileSelect(item.file);
                        // If manually selected, remove from auto-selected set
                        if (this.autoSelectedFiles.has(path)) {
                            console.log('[FileDetect] File manually selected, removing from auto-selected:', path);
                            this.autoSelectedFiles.delete(path);
                        }
                    } else {
                        await this.handleFileDeselect(item.file);
                        // Also remove from auto-selected if it was there
                        this.autoSelectedFiles.delete(path);
                    }
                    // Update parent directory states after file selection change
                    this.updateParentDirectoryStates();
                });
                
                // Shift-click for range selection
                element.addEventListener('click', async (e) => {
                    if (e.target.type !== 'checkbox') {
                        if (e.shiftKey && this.lastSelectedIndex >= 0) {
                            // Range selection
                            const currentIndex = parseInt(element.dataset.index);
                            const start = Math.min(this.lastSelectedIndex, currentIndex);
                            const end = Math.max(this.lastSelectedIndex, currentIndex);
                            
                            // Select all items in range
                            const items = container.querySelectorAll('.directory-item');
                            for (let i = start; i <= end; i++) {
                                const item = items[i];
                                const cb = item.querySelector('input[type="checkbox"]');
                                if (cb && !cb.checked) {
                                    cb.checked = true;
                                    cb.dispatchEvent(new Event('change'));
                                }
                            }
                        } else {
                            // Single selection
                            checkbox.checked = !checkbox.checked;
                            checkbox.dispatchEvent(new Event('change'));
                            this.lastSelectedIndex = parseInt(element.dataset.index);
                        }
                    }
                });
                
                container.appendChild(element);
            }
        });
    }

    getSizeClass(bytes) {
        // Estimate tokens (roughly 4 chars per token, so bytes/4)
        const estimatedTokens = bytes / 4;
        if (estimatedTokens < 500) return 'heat-low';      // Green
        if (estimatedTokens < 2000) return 'heat-medium';  // Yellow/Amber
        return 'heat-high';                                 // Red
    }
    
    formatBytes(bytes, decimals = 1) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    getTokenHeatBar(bytes) {
        const estimatedTokens = Math.round(bytes / 4);
        const percentage = Math.min(100, (estimatedTokens / 5000) * 100); // Max out at 5000 tokens
        
        return `
            <div class="token-heat-bar" title="${estimatedTokens.toLocaleString()} tokens (est.)">
                <div class="heat-fill" style="width: ${percentage}%"></div>
            </div>
        `;
    }

    getDirectoryHeatBar(totalBytes, fileCount) {
        const estimatedTokens = Math.round(totalBytes / 4);
        const percentage = Math.min(100, (estimatedTokens / 20000) * 100); // Higher max for directories
        const sizeStr = this.formatBytes(totalBytes);
        
        return `
            <div class="token-heat-bar directory-heat-bar" title="${fileCount} files, ${sizeStr}, ~${estimatedTokens.toLocaleString()} tokens total">
                <div class="heat-fill" style="width: ${percentage}%"></div>
            </div>
        `;
    }

    async handleFileSelect(file) {
        const path = file.webkitRelativePath;
        console.log('[FileDetect] handleFileSelect called for:', path);
        
        if (this.lazyLoadEnabled) {
            console.log('[FileDetect] Lazy load enabled - adding metadata only');
            // Add metadata only
            this.fileHandler.addFileMetadata(path, file);
            this.updateFileCheckbox(path, true);
            this.updateStats();
            this.updateGenerateButton();
        } else {
            console.log('[FileDetect] Lazy load disabled - loading content immediately');
            // Load content immediately
            if (this.fileWorker) {
                const id = `${path}_${Date.now()}`;
                this.fileWorker.postMessage({
                    type: 'READ',
                    data: { file, path, id }
                });
                this.showToast(`Loading ${file.name}...`);
            }
        }
    }

    async handleFileDeselect(file) {
        const path = file.webkitRelativePath;
        this.fileHandler.selectedFiles.delete(path);
        this.fileHandler.metadata.delete(path);
        this.fileHandler.pendingFiles.delete(path);
        this.updateFileCheckbox(path, false);
        this.updateStats();
        this.updateGenerateButton();
    }

    updateStats() {
        // Update explorer stats
        this.updateExplorerStats();
        
        // Update preview badge
        const selectedCount = this.fileHandler.getAllSelectedPaths().length;
        this.previewBadge.textContent = selectedCount;
        
        // Update batch action bar (only show if not in preview tab)
        if (selectedCount > 0 && this.activeTab !== 'preview') {
            this.batchSelectedCount.textContent = selectedCount;
            this.batchActionBar.style.display = 'flex';
        } else {
            this.batchActionBar.style.display = 'none';
        }
        
        // Update selected files display
        this.updateSelectedFiles();
        
        // Update footer stats
        const loadedFiles = this.fileHandler.getSelectedFiles();
        this.fileCount.textContent = loadedFiles.length;
        
        // Update output
        this.updateOutput();
        
        // Update parent directory states
        this.updateParentDirectoryStates();
    }

    updateGenerateButton() {
        const hasPrompt = this.promptInput.value.trim().length > 0;
        // Meta-prompt button only needs prompt text, not files
        this.generatePromptBtn.disabled = !hasPrompt;
    }

    updatePromptStats() {
        const text = this.promptInput.value;
        this.promptCharCount.textContent = text.length;
        this.promptTokenCount.textContent = this.estimateTokens(text);
        this.updateGenerateButton();
    }

    updateOutput() {
        const prompt = this.promptInput.value;
        const content = this.fileHandler.getFinalContent(prompt, true); // true = for preview
        
        if (this.editor) {
            this.editor.setValue(content);
        } else {
            this.outputArea.value = content;
        }
        
        this.updateCounts(content);
    }

    updateCounts(content) {
        const charCount = content.length;
        const tokenCount = this.estimateTokens(content);
        this.totalCharCount.textContent = charCount.toLocaleString();
        this.totalTokenCount.textContent = tokenCount.toLocaleString();
    }

    estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }

    updateSelectedFiles() {
        const allPaths = this.fileHandler.getAllSelectedPaths();
        this.selectedFiles.innerHTML = allPaths.map((path, index) => {
            const isLoaded = this.fileHandler.isFileLoaded(path);
            const meta = this.fileHandler.metadata.get(path);
            const fileName = path.split('/').pop();
            const tokenBar = meta ? this.getTokenHeatBar(meta.size) : '';
            
            return `
            <div class="selected-file ${!isLoaded ? 'pending' : ''}" data-path="${path}">
                <i class="bi ${isLoaded ? 'bi-file-text-fill' : 'bi-file-earmark'}"></i>
                <span class="flex-fill" title="${path}">${fileName}</span>
                ${isLoaded ? tokenBar : '<span class="badge bg-warning ms-2">Pending</span>'}
                <div class="btn-group btn-group-sm">
                    ${!isLoaded ? 
                        `<button class="btn btn-sm btn-outline-success" onclick="ui.loadFileContent('${path}')" title="Load content">
                            <i class="bi bi-download"></i>
                        </button>` : 
                        `<button class="btn btn-sm btn-outline-primary" onclick="ui.summarizeFile('${path}')" title="Summarize">
                            <i class="bi bi-card-text"></i>
                        </button>`
                    }
                    <button class="btn btn-sm btn-outline-danger" onclick="ui.removeFile('${path}')">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
            </div>
        `}).join('');
    }

    async removeFile(path) {
        const file = this.fileMap[path];
        if (file) {
            await this.handleFileDeselect(file);
        }
    }

    async copyToClipboard() {
        try {
            // First, check if there are any pending files
            const pendingFiles = Array.from(this.fileHandler.pendingFiles);
            
            if (pendingFiles.length > 0) {
                // Show loading state
                this.copyBtn.disabled = true;
                const originalBtnHtml = this.copyBtn.innerHTML;
                this.copyBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Loading files...';
                
                try {
                    // Load all pending files
                    await this.loadAllPendingFiles();
                    
                    // Wait a bit for the files to be processed
                    await new Promise(resolve => setTimeout(resolve, 500));
                } finally {
                    // Restore button state
                    this.copyBtn.disabled = false;
                    this.copyBtn.innerHTML = originalBtnHtml;
                }
            }
            
            // Get full content (not truncated) for copying
            const prompt = this.promptInput.value;
            const fullContent = this.fileHandler.getFinalContent(prompt, false); // false = full content
            await navigator.clipboard.writeText(fullContent);
            this.showToast('Full content copied to clipboard!');
        } catch (error) {
            this.showToast('Failed to copy content', true);
        }
    }

    async loadAllPendingFiles() {
        const pendingFiles = Array.from(this.fileHandler.pendingFiles);
        if (pendingFiles.length === 0) return;
        
        this.showToast(`Loading ${pendingFiles.length} pending files...`);
        
        // Collect file objects for all pending files
        const filesToLoad = pendingFiles.map(path => ({
            file: this.fileMap[path],
            path: path
        })).filter(item => item.file); // Filter out any missing files
        
        if (filesToLoad.length === 0) {
            this.showToast('No valid files to load', true);
            return;
        }
        
        if (this.fileWorker) {
            // Use worker for batch loading
            const batchId = `load_all_${Date.now()}`;
            
            return new Promise((resolve) => {
                // Set up a one-time listener for this batch completion
                const originalHandler = this.fileWorker.onmessage;
                this.fileWorker.onmessage = (event) => {
                    const { type, ...data } = event.data;
                    
                    if (type === 'BATCH_COMPLETE' && data.batchId === batchId) {
                        // Restore original handler and resolve
                        this.fileWorker.onmessage = originalHandler;
                        resolve();
                    } else {
                        // Call original handler for other messages
                        originalHandler.call(this, event);
                    }
                };
                
                this.fileWorker.postMessage({
                    type: 'READ_BATCH',
                    data: { files: filesToLoad, batchId }
                });
            });
        } else {
            // Fallback: load files one by one
            for (const { file, path } of filesToLoad) {
                try {
                    const content = await file.text();
                    this.fileHandler.markFileLoaded(path, content);
                } catch (error) {
                    console.error(`Error loading ${path}:`, error);
                }
            }
            this.updateStats();
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

    // Initialize remaining methods from original controller...
    
    initializeCodeMirror() {
        // Initialize CodeMirror for the output area
        this.editor = CodeMirror.fromTextArea(this.outputArea, {
            mode: 'gfm',
            theme: 'dracula',
            lineNumbers: true,
            lineWrapping: true,
            readOnly: true,
            viewportMargin: Infinity
        });
        
        this.editor.on('change', () => {
            this.updateCounts(this.editor.getValue());
        });
    }

    // Worker handlers
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
        const wasLazyLoad = this.fileHandler.pendingFiles.has(path);
        
        console.log('[FileDetect] handleFileContent received for:', path);
        
        this.fileHandler.markFileLoaded(path, text);
        
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
        
        const pending = this.pendingFileReads.get(id);
        if (pending) {
            pending.resolve({ path, text });
            this.pendingFileReads.delete(id);
        }
        
        // Update the checkbox to reflect the file is now selected
        this.updateFileCheckbox(path, true);
        
        this.updateStats();
        
        if (wasLazyLoad) {
            this.showToast(`Loaded: ${path.split('/').pop()}`);
        }
    }

    handleBatchComplete(data) {
        const { batchId, results, errors } = data;
        
        console.log('[FileDetect] handleBatchComplete - processing', results.length, 'results');
        
        results.forEach(result => {
            this.fileHandler.markFileLoaded(result.path, result.text);
            if (result.metadata) {
                this.fileHandler.metadata.set(result.path, {
                    mtime: result.metadata.lastModified,
                    size: result.metadata.size,
                    hash: this.fileHandler.simpleHash(result.text),
                    loaded: true
                });
            }
            
            // Update the checkbox for this file
            this.updateFileCheckbox(result.path, true);
        });
        
        if (errors.length > 0) {
            console.error('Batch read errors:', errors);
            this.showToast(`Failed to read ${errors.length} files`, true);
        }
        
        this.updateStats();
        
        if (results.length > 0) {
            this.showToast(`Loaded ${results.length} files`);
        }
    }

    handleBatchProgress(data) {
        const { processed, total } = data;
        console.log(`File loading progress: ${processed}/${total}`);
    }

    handleWorkerError(data) {
        const { path, error } = data;
        console.error(`Worker error for ${path}:`, error);
        this.showToast(`Error reading ${path}: ${error}`, true);
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
                this.updateStats();
                this.showToast(`Loaded ${file.name}`);
            } catch (error) {
                this.showToast(`Error loading file: ${error.message}`, true);
            }
        }
    }

    async selectAllFiles() {
        if (!this.allFiles || this.allFiles.length === 0) {
            this.showToast('No files loaded to select', true);
            return;
        }
        
        const filesToLoad = this.allFiles.filter(file => 
            !this.fileHandler.selectedFiles.has(file.webkitRelativePath) &&
            !this.fileHandler.pendingFiles.has(file.webkitRelativePath)
        );
        
        if (filesToLoad.length === 0) {
            this.showToast('All files already selected!');
            return;
        }
        
        // Update all checkboxes immediately
        this.updateAllCheckboxes(true);
        
        if (this.lazyLoadEnabled) {
            // Just add metadata for all files
            filesToLoad.forEach(file => {
                this.fileHandler.addFileMetadata(file.webkitRelativePath, file);
            });
            this.updateStats();
            this.showToast(`Selected ${filesToLoad.length} files (lazy load)`);
        } else if (this.fileWorker) {
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
        }
    }

    clearSelection() {
        this.fileHandler.selectedFiles.clear();
        this.fileHandler.metadata.clear();
        this.fileHandler.pendingFiles.clear();
        this.autoSelectedFiles.clear(); // Clear auto-selected tracking
        this.updateAllCheckboxes(false);
        this.updateStats();
        this.showToast('Selection cleared');
    }

    async toggleDirectorySelection(dirItem, isChecked) {
        const filesToProcess = [];
        const allPaths = [];
        const directoryElements = [];
        
        const traverse = (item, parentPath = '') => {
            if (item.type === 'file') {
                const path = item.file.webkitRelativePath;
                allPaths.push(path);
                
                if (isChecked && !this.fileHandler.selectedFiles.has(path) && !this.fileHandler.pendingFiles.has(path)) {
                    filesToProcess.push({ file: item.file, path });
                } else if (!isChecked) {
                    this.fileHandler.selectedFiles.delete(path);
                    this.fileHandler.metadata.delete(path);
                    this.fileHandler.pendingFiles.delete(path);
                }
            } else if (item.children) {
                // Build the full path for this directory
                const dirPath = parentPath ? `${parentPath}/${item.name}` : item.name;
                
                // Find the directory element by looking for the data-path or by structure
                let dirElement = null;
                
                // Try to find by a unique identifier first
                const allDirItems = document.querySelectorAll('.directory-item');
                for (const el of allDirItems) {
                    const span = el.querySelector('span');
                    const icon = el.querySelector('.bi-folder, .bi-folder-open');
                    if (span && icon && span.textContent === item.name) {
                        // Check if this is the right directory by checking parent structure
                        let isCorrect = true;
                        if (parentPath) {
                            // Verify this is in the correct parent path
                            let parent = el.parentElement;
                            const pathParts = parentPath.split('/').reverse();
                            for (const part of pathParts) {
                                const parentDir = parent?.previousElementSibling;
                                const parentSpan = parentDir?.querySelector('span');
                                if (!parentSpan || parentSpan.textContent !== part) {
                                    isCorrect = false;
                                    break;
                                }
                                parent = parentDir?.parentElement;
                            }
                        }
                        if (isCorrect) {
                            dirElement = el;
                            break;
                        }
                    }
                }
                
                if (dirElement) {
                    directoryElements.push(dirElement);
                }
                
                // Traverse children
                item.children.forEach(child => traverse(child, dirPath));
            }
        };
        
        // Start traversal
        traverse(dirItem);
        
        // Update all file checkboxes
        allPaths.forEach(path => {
            this.updateFileCheckbox(path, isChecked);
        });
        
        // Update all subdirectory checkboxes
        directoryElements.forEach(element => {
            this.updateDirectoryCheckbox(element, isChecked);
        });
        
        if (isChecked && filesToProcess.length > 0) {
            if (this.lazyLoadEnabled) {
                filesToProcess.forEach(({ file, path }) => {
                    this.fileHandler.addFileMetadata(path, file);
                });
                this.updateStats();
                this.showToast(`Selected ${filesToProcess.length} files from directory`);
            } else if (this.fileWorker) {
                const batchId = `dir_${Date.now()}`;
                this.showToast(`Loading ${filesToProcess.length} files from directory...`);
                
                this.fileWorker.postMessage({
                    type: 'READ_BATCH',
                    data: { files: filesToProcess, batchId }
                });
            }
        } else {
            this.updateStats();
        }
    }

    async refreshSelectedFiles() {
        if (!this.fileMap || Object.keys(this.fileMap).length === 0) {
            this.showToast('No folder loaded to refresh', true);
            return;
        }
        
        const filesToRefresh = [];
        for (const [path] of this.fileHandler.selectedFiles) {
            if (this.fileMap[path]) {
                filesToRefresh.push({ file: this.fileMap[path], path });
            }
        }
        
        if (filesToRefresh.length === 0) {
            this.showToast('No files to refresh');
            return;
        }
        
        if (this.fileWorker) {
            const batchId = `refresh_${Date.now()}`;
            this.showToast(`Refreshing ${filesToRefresh.length} files...`);
            
            this.fileWorker.postMessage({
                type: 'READ_BATCH',
                data: { files: filesToRefresh, batchId }
            });
        }
    }

    async refreshStaleFiles() {
        const staleFiles = [];
        for (const [path, meta] of this.fileHandler.metadata) {
            if (meta.stale) {
                const file = this.fileMap[path];
                if (file) {
                    staleFiles.push({ file, path });
                }
            }
        }
        
        if (staleFiles.length === 0) {
            this.showToast('No stale files to refresh');
            return;
        }
        
        if (this.fileWorker) {
            const batchId = `stale_${Date.now()}`;
            this.showToast(`Refreshing ${staleFiles.length} stale files...`);
            
            this.fileWorker.postMessage({
                type: 'READ_BATCH',
                data: { files: staleFiles, batchId }
            });
        }
    }

    startAutoRefresh() {
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
        const item = document.querySelector(`[data-path="${path}"]`);
        if (item && !item.querySelector('.stale-indicator')) {
            const indicator = document.createElement('span');
            indicator.className = 'stale-indicator';
            item.appendChild(indicator);
        }
    }

    async generateMetaPrompt() {
        const currentText = this.promptInput.value.trim();
        
        console.log('Generate Meta-Prompt clicked, current text:', currentText);
        
        if (!currentText) {
            this.showToast('Please enter some text first', true);
            return;
        }
        
        // Update button states
        this.generatePromptBtn.disabled = true;
        const originalButtonHtml = this.generatePromptBtn.innerHTML;
        this.generatePromptBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';
        
        try {
            console.log('Sending request to /api/generate-prompt');
            console.log('Auth token available:', typeof authToken !== 'undefined' ? 'Yes' : 'No');
            console.log('Window.fetch is overridden:', window.fetch !== window.originalFetch);
            
            // Build headers with auth token if available
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Add auth header if token is available (fallback if fetch override isn't working)
            if (typeof authToken !== 'undefined' && authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
                console.log('Manually adding auth header');
            }
            
            const response = await fetch('/api/generate-prompt', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ input: currentText })
            });
            
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                const error = await response.json();
                console.error('API Error:', error);
                throw new Error(error.error || 'Failed to generate meta-prompt');
            }
            
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
                                    // Update prompt input in real-time
                                    this.promptInput.value = generatedText;
                                    
                                    // Auto-resize textarea
                                    this.promptInput.style.height = 'auto';
                                    this.promptInput.style.height = this.promptInput.scrollHeight + 'px';
                                    
                                    console.log('Received text chunk:', parsed.text);
                                }
                                
                                if (parsed.done) {
                                    console.log('Generation complete');
                                    this.showToast('Meta-prompt generated successfully!');
                                    this.updatePromptStats();
                                }
                            } catch (e) {
                                console.error('Error parsing SSE data:', e);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error in generateMetaPrompt:', error);
            this.showToast(`Error generating meta-prompt: ${error.message}`, true);
        } finally {
            this.generatePromptBtn.disabled = false;
            this.generatePromptBtn.innerHTML = originalButtonHtml;
            this.updateGenerateButton();
        }
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
            
            const summarizedContent = `[SUMMARIZED]\n${data.summary}\n[Original: ${data.original_length} chars → ${data.summary_length} chars]`;
            this.fileHandler.selectedFiles.set(path, summarizedContent);
            
            this.updateStats();
            this.showToast(`File summarized: ${path}`);
            
            const fileElement = document.querySelector(`[data-path="${path}"]`);
            if (fileElement) {
                fileElement.classList.add('text-info');
            }
        } catch (error) {
            this.showToast(`Error summarizing file: ${error.message}`, true);
        }
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

    // Helper methods
    getRootPath(file) {
        const parts = file.webkitRelativePath.split('/');
        return parts[0];
    }

    buildFileTree(files, rootPath) {
        const tree = {
            name: rootPath,
            type: 'directory',
            children: new Map(),
            totalSize: 0,
            fileCount: 0
        };

        files.forEach(file => {
            const parts = file.webkitRelativePath.split('/');
            let current = tree;

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
                            children: new Map(),
                            totalSize: 0,
                            fileCount: 0
                        });
                    }
                    current = current.children.get(part);
                }
            }
        });

        // Calculate directory sizes recursively
        this.calculateDirectorySizes(tree);

        return tree;
    }

    calculateDirectorySizes(node) {
        if (node.type === 'file') {
            return { size: node.file.size, count: 1 };
        }

        let totalSize = 0;
        let totalCount = 0;

        for (const child of node.children.values()) {
            const { size, count } = this.calculateDirectorySizes(child);
            totalSize += size;
            totalCount += count;
        }

        node.totalSize = totalSize;
        node.fileCount = totalCount;

        return { size: totalSize, count: totalCount };
    }

    updateFileCheckbox(path, checked) {
        console.log('[FileDetect] updateFileCheckbox called:', { path, checked });
        
        const item = document.querySelector(`[data-path="${path}"]`);
        console.log('[FileDetect] Found item element:', item);
        
        if (item) {
            const checkbox = item.querySelector('input[type="checkbox"]');
            console.log('[FileDetect] Found checkbox:', checkbox);
            
            if (checkbox) {
                checkbox.checked = checked;
                console.log('[FileDetect] Checkbox updated successfully');
                
                // Also trigger change event to ensure UI updates
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                console.warn('[FileDetect] No checkbox found in item for path:', path);
            }
        } else {
            console.warn('[FileDetect] No element found with data-path:', path);
            
            // Debug: Log all elements with data-path to see what's available
            const allPathElements = document.querySelectorAll('[data-path]');
            console.log('[FileDetect] All elements with data-path:', allPathElements.length);
            if (allPathElements.length < 10) {
                allPathElements.forEach(el => {
                    console.log('[FileDetect]   - data-path:', el.dataset.path);
                });
            }
        }
    }

    updateDirectoryCheckbox(element, checked, indeterminate = false) {
        if (element) {
            const checkbox = element.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.checked = checked;
                checkbox.indeterminate = indeterminate;
            }
        }
    }

    updateParentDirectoryStates() {
        // Find all directory items and update their checkbox states based on children
        const allDirectories = document.querySelectorAll('.directory-item .bi-folder, .directory-item .bi-folder-open');
        
        allDirectories.forEach(icon => {
            const dirElement = icon.parentElement;
            const dirCheckbox = dirElement.querySelector('input[type="checkbox"]');
            if (!dirCheckbox) return;
            
            const childContainer = dirElement.nextElementSibling;
            if (!childContainer) return;
            
            const childCheckboxes = childContainer.querySelectorAll('input[type="checkbox"]');
            if (childCheckboxes.length === 0) return;
            
            let checkedCount = 0;
            let totalCount = 0;
            
            childCheckboxes.forEach(cb => {
                totalCount++;
                if (cb.checked && !cb.indeterminate) checkedCount++;
                else if (cb.indeterminate) checkedCount += 0.5; // Count indeterminate as partial
            });
            
            if (checkedCount === 0) {
                this.updateDirectoryCheckbox(dirElement, false, false);
            } else if (checkedCount === totalCount) {
                this.updateDirectoryCheckbox(dirElement, true, false);
            } else {
                this.updateDirectoryCheckbox(dirElement, false, true);
            }
        });
    }

    updateAllCheckboxes(checked) {
        const checkboxes = document.querySelectorAll('.directory-item input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
        });
    }

    shouldIgnore(path) {
        const lowerPath = path.toLowerCase();

        if (this.ignoreRules && this.ignoreRules.length > 0) {
            for (const rule of this.ignoreRules) {
                if (this.matchesGlob(path, rule)) return true;
            }
        }

        const ignoreDirs = [
            '/.git/', '/.svn/', '/.vscode/', '/.idea/', '/node_modules/', '/venv/', '/.venv/', '/build/', '/dist/', '/out/', '/.next/', '/coverage/', '/.pytest_cache/'
        ];
        for (const dir of ignoreDirs) {
            if (lowerPath.includes(dir)) return true;
        }

        const ignoreFiles = ['.gitignore', '.npmrc', '.prettierrc', '.eslintrc', '.babelrc'];
        const fileName = lowerPath.split('/').pop();
        if (ignoreFiles.includes(fileName)) return true;

        const ignoreExts = ['.log', '.json', '.pyc', '.pyo', '.pyd', '.class'];
        for (const ext of ignoreExts) {
            if (fileName.endsWith(ext)) return true;
        }
        return false;
    }

    matchesGlob(path, pattern) {
        const regex = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        return new RegExp(regex).test(path);
    }

    loadIgnoreRules() {
        const savedRules = localStorage.getItem('ignoreRules');
        if (savedRules) {
            this.ignoreRules = JSON.parse(savedRules);
            this.ignoreRulesTextarea.value = this.ignoreRules.join('\n');
        } else {
            this.ignoreRules = [];
        }
    }

    saveIgnoreRules() {
        const rulesText = this.ignoreRulesTextarea.value;
        this.ignoreRules = rulesText.split('\n').filter(rule => rule.trim());
        localStorage.setItem('ignoreRules', JSON.stringify(this.ignoreRules));
        this.ignoreModal.hide();
        this.showToast('Ignore rules saved!');
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
        
        this.clearSelection();

        if (this.allFiles) {
            const filesToSelect = [];
            
            for (const file of this.allFiles) {
                const path = file.webkitRelativePath;
                const shouldInclude = preset.include.some(pattern => this.matchesGlob(path, pattern));
                const shouldExclude = preset.exclude.some(pattern => this.matchesGlob(path, pattern));
                
                if (shouldInclude && !shouldExclude) {
                    filesToSelect.push(file);
                }
            }
            
            if (this.lazyLoadEnabled) {
                filesToSelect.forEach(file => {
                    this.fileHandler.addFileMetadata(file.webkitRelativePath, file);
                    this.updateFileCheckbox(file.webkitRelativePath, true);
                });
                this.updateStats();
                this.showToast(`Applied preset: ${presetName} (${filesToSelect.length} files)`);
            } else if (this.fileWorker && filesToSelect.length > 0) {
                const batchId = `preset_${Date.now()}`;
                const fileData = filesToSelect.map(file => ({
                    file,
                    path: file.webkitRelativePath
                }));
                
                this.showToast(`Loading ${filesToSelect.length} files for preset: ${presetName}`);
                
                this.fileWorker.postMessage({
                    type: 'READ_BATCH',
                    data: { files: fileData, batchId }
                });
                
                filesToSelect.forEach(file => {
                    this.updateFileCheckbox(file.webkitRelativePath, true);
                });
            }
        }
    }


    // Batch action methods
    async batchSummarize() {
        const selectedPaths = this.fileHandler.getAllSelectedPaths();
        if (selectedPaths.length === 0) return;
        
        this.showToast(`Summarizing ${selectedPaths.length} files...`);
        
        // TODO: Implement batch summarization
        // For now, just show a placeholder
        this.showToast('Batch summarization coming soon!', true);
    }

    async batchDiff() {
        const selectedPaths = this.fileHandler.getAllSelectedPaths();
        if (selectedPaths.length === 0) return;
        
        this.showToast('Diff view coming soon!', true);
        
        // TODO: Implement diff view
        // This would show only the changes between versions
    }
    
    // ===== File Detection Methods =====
    
    showDetectSpinner(msg = 'Detecting files…') {
        this._detectInProgress++;
        console.log('[FileDetect] showDetectSpinner - counter:', this._detectInProgress);
        
        // Clear any existing failsafe timeout
        if (this._detectSpinnerTimeout) {
            clearTimeout(this._detectSpinnerTimeout);
        }
        
        if (this.detectSpinner) {
            // Spinner already visible, just update the counter
            console.log('[FileDetect] Spinner already visible');
        } else {
            this.detectSpinner = document.createElement('div');
            this.detectSpinner.className = 'position-fixed top-0 end-0 m-3 z-2000 d-flex align-items-center bg-body rounded shadow-sm px-3 py-2';
            this.detectSpinner.innerHTML = `
                <div class="spinner-border spinner-border-sm me-2" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <span class="small">${msg}</span>
            `;
            document.body.appendChild(this.detectSpinner);
            console.log('[FileDetect] Spinner created and added to DOM');
        }
        
        // Set a failsafe timeout of 10 seconds
        this._detectSpinnerTimeout = setTimeout(() => {
            console.warn('[FileDetect] Failsafe timeout - forcing spinner removal');
            this._detectInProgress = 0;
            if (this.detectSpinner) {
                this.detectSpinner.remove();
                this.detectSpinner = null;
            }
        }, 10000);
    }
    
    hideDetectSpinner() {
        this._detectInProgress = Math.max(0, this._detectInProgress - 1);
        console.log('[FileDetect] hideDetectSpinner - counter:', this._detectInProgress);
        
        // Only hide if no detections are in progress
        if (this._detectInProgress === 0 && this.detectSpinner) {
            // Clear the failsafe timeout
            if (this._detectSpinnerTimeout) {
                clearTimeout(this._detectSpinnerTimeout);
                this._detectSpinnerTimeout = null;
            }
            
            this.detectSpinner.remove();
            this.detectSpinner = null;
            console.log('[FileDetect] Spinner removed from DOM');
        } else if (this._detectInProgress > 0) {
            console.log('[FileDetect] Spinner kept - still', this._detectInProgress, 'operations in progress');
        }
    }
    
    async autoDetectFiles(text) {
        console.log('[FileDetect] autoDetectFiles called with text length:', text?.length);
        
        if (!text || !this.allFiles || this.allFiles.length === 0) {
            console.log('[FileDetect] No text or no files loaded');
            return; // No project loaded yet
        }
        
        const candidates = extractPathCandidates(text);
        console.log('[FileDetect] Extracted candidates:', candidates);
        
        // If no candidates, check if we need to remove auto-selected files
        if (candidates.length === 0) {
            await this.removeUnmentionedAutoSelectedFiles([]);
            return;
        }
        
        this.showDetectSpinner();
        
        try {
            // Build or update fuzzy matcher
            if (!this._fuzzyMatcher) {
                const paths = Object.keys(this.fileMap);
                this._fuzzyMatcher = createPathMatcher(paths);
            }
            
            // Categorize matches
            const matches = categorizeMatches(candidates, this.fileMap, this._fuzzyMatcher);
            
            // Process matches
            const toLoad = [
                ...matches.exact,
                ...matches.fuzzy.map(f => f.matched)
            ];
            
            // Remove auto-selected files that are no longer mentioned
            await this.removeUnmentionedAutoSelectedFiles(toLoad);
            
            let selectedCount = 0;
            let alreadySelectedCount = 0;
            
            for (const path of toLoad) {
                const file = this.fileMap[path];
                if (!file) continue;
                
                // Check if already selected
                if (this.fileHandler.selectedFiles.has(path) || this.fileHandler.pendingFiles.has(path)) {
                    alreadySelectedCount++;
                    continue;
                }
                
                // Select the file and track as auto-selected
                await this.handleFileSelect(file);
                this.autoSelectedFiles.add(path);
                selectedCount++;
            }
            
            // Update stats
            this.updateStats();
            
            // Update parent directory checkboxes to reflect new selections
            this.updateParentDirectoryStates();
            
            // Show feedback
            let message = '';
            if (selectedCount > 0) {
                message = `Auto-selected ${selectedCount} file${selectedCount !== 1 ? 's' : ''}`;
            }
            if (matches.unmatched.length > 0) {
                if (message) message += '. ';
                message += `${matches.unmatched.length} path${matches.unmatched.length !== 1 ? 's' : ''} not found`;
            }
            if (alreadySelectedCount > 0) {
                if (message) message += '. ';
                message += `${alreadySelectedCount} already selected`;
            }
            
            if (message) {
                this.showToast(message);
            }
            
            // Log unmatched for debugging
            if (matches.unmatched.length > 0) {
                console.log('Unmatched file references:', matches.unmatched);
            }
        } catch (error) {
            console.error('[FileDetect] Error during auto-detection:', error);
            this.showToast('Error detecting files', 'danger');
        } finally {
            // Always hide spinner
            this.hideDetectSpinner();
        }
    }
    
    // Reset fuzzy matcher when files change
    resetFuzzyMatcher() {
        this._fuzzyMatcher = null;
    }
    
    // Remove auto-selected files that are no longer mentioned in the prompt
    async removeUnmentionedAutoSelectedFiles(currentlyMentioned) {
        const mentionedSet = new Set(currentlyMentioned);
        const toRemove = [];
        
        // Find auto-selected files that are no longer mentioned
        for (const path of this.autoSelectedFiles) {
            if (!mentionedSet.has(path)) {
                toRemove.push(path);
            }
        }
        
        // Remove them
        for (const path of toRemove) {
            console.log('[FileDetect] Removing auto-selected file no longer in prompt:', path);
            this.autoSelectedFiles.delete(path);
            
            // Only deselect if it's still selected (user might have manually deselected)
            if (this.fileHandler.selectedFiles.has(path) || this.fileHandler.pendingFiles.has(path)) {
                const file = this.fileMap[path];
                if (file) {
                    // Deselect the file using the existing method
                    await this.handleFileDeselect(file);
                }
            }
        }
        
        // Update UI if files were removed
        if (toRemove.length > 0) {
            this.updateStats();
            console.log('[FileDetect] Removed', toRemove.length, 'auto-selected files');
        }
    }
}

// Export as default for ES module
export default UIController;