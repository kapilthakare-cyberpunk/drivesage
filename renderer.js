const { ipcRenderer } = require('electron');
const path = require('path');

// App state management
class AppState {
    constructor() {
        this.currentDrive = null;
        this.analysis = null;
        this.isScanning = false;
        this.isOrganizing = false;
        this.settings = {
            dryRun: true,
            autoBackup: true,
            protectedPatterns: ['gemini', 'ai', 'assistant', 'code', 'project']
        };
        this.loadSettings();
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('drivesage-settings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('drivesage-settings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
        uiManager.updateUI();
    }
}

// UI Manager
class UIManager {
    constructor() {
        this.elements = {};
        this.initializeElements();
        this.bindEvents();
        this.setupTheme();
    }

    initializeElements() {
        const ids = [
            'dashboard-section', 'scan-section', 'organize-section', 'duplicates-section', 'settings-section',
            'quick-stats', 'dashboard-scan-btn', 'dashboard-organize-btn',
            'drive-path', 'scan-btn', 'scan-progress', 'scan-loading', 'scan-status', 'analysis-results',
            'folder-list', 'large-files-list', 'system-files-list', 'protected-files-list',
            'organize-btn', 'dry-run-toggle', 'operations-list',
            'duplicates-list', 'find-duplicates-btn',
            'auto-backup-toggle', 'protected-patterns', 'save-settings-btn'
        ];
        ids.forEach(id => {
            this.elements[this.camelCase(id)] = document.getElementById(id);
        });
        this.elements.notification = document.querySelector('.notification');
    }

    camelCase(kebabCaseString) {
        return kebabCaseString.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.showSection(e.currentTarget.dataset.section);
            });
        });

        // Dashboard buttons
        this.elements.dashboardScanBtn.addEventListener('click', () => {
            this.showNotification('Navigating to Scan section...', 'info');
            this.showSection('scan');
        });
        this.elements.dashboardOrganizeBtn.addEventListener('click', () => {
            this.showNotification('Navigating to Organize section...', 'info');
            this.showSection('organize');
        });
        
        // Drive path selection
        this.elements.drivePathInput.addEventListener('change', (e) => {
            appState.currentDrive = e.target.value;
        });

        // Scan button
        this.elements.scanButton.addEventListener('click', () => {
            this.startScan();
        });

        // Organize button
        this.elements.organizeButton.addEventListener('click', () => {
            this.startOrganization();
        });

        // Find duplicates button
        this.elements.findDuplicatesButton.addEventListener('click', () => {
            this.findDuplicates();
        });

        // Settings
        this.elements.saveSettingsButton.addEventListener('click', () => {
            this.saveSettings();
        });

        // Dry run toggle
        this.elements.dryRunToggle.addEventListener('change', (e) => {
            appState.updateSettings({ dryRun: e.target.checked });
        });

        // Auto backup toggle
        this.elements.autoBackupToggle.addEventListener('change', (e) => {
            appState.updateSettings({ autoBackup: e.target.checked });
        });

        // Menu events
        ipcRenderer.on('menu-scan-drive', () => {
            this.showSection('scan');
        });

        ipcRenderer.on('menu-open-settings', () => {
            this.showSection('settings');
        });
    }

    setupTheme() {
        // Check for system dark mode preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-theme');
        }

        // Theme toggle (if you want to add one)
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                document.body.classList.toggle('dark-theme');
            });
        }
    }

    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.style.display = 'none';
        });

        // Show selected section
        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.style.display = 'block';
        }

        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
    }

    updateUI() {
        // Update settings UI
        this.elements.dryRunToggle.checked = appState.settings.dryRun;
        this.elements.autoBackupToggle.checked = appState.settings.autoBackup;
        this.elements.protectedPatternsInput.value = appState.settings.protectedPatterns.join(', ');

        // Update analysis display if available
        if (appState.analysis) {
            this.displayAnalysis(appState.analysis);
        }
    }

    async startScan() {
        if (!appState.currentDrive) {
            this.showNotification('Please select a drive path first', 'error');
            return;
        }

        if (appState.isScanning) {
            return;
        }

        appState.isScanning = true;
        this.showLoading('Scanning drive...', true);

        try {
            const result = await ipcRenderer.invoke('analyze-drive', appState.currentDrive);
            
            if (result.success) {
                appState.analysis = result.data;
                this.displayAnalysis(result.data);
                this.showNotification('Drive analysis completed successfully!', 'success');
                this.showSection('analysis');
            } else {
                this.showNotification(`Scan failed: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showNotification(`Scan error: ${error.message}`, 'error');
        } finally {
            appState.isScanning = false;
            this.hideLoading();
        }
    }

    displayAnalysis(analysis) {
        // Update quick stats
        this.elements.quickStats.innerHTML = `
            <div class="stat-card">
                <h3>${this.formatFileSize(analysis.metadata.totalSize)}</h3>
                <p>Total Size</p>
            </div>
            <div class="stat-card">
                <h3>${analysis.metadata.fileCount.toLocaleString()}</h3>
                <p>Files</p>
            </div>
            <div class="stat-card">
                <h3>${analysis.metadata.folderCount.toLocaleString()}</h3>
                <p>Folders</p>
            </div>
            <div class="stat-card">
                <h3>${analysis.duplicates.length}</h3>
                <p>Duplicates</p>
            </div>
        `;

        // Display folders
        this.elements.folderList.innerHTML = `<h3>Folders</h3>` + analysis.folders.map(folder => `
            <div class="folder-item">
                <div class="folder-info">
                    <h4>${folder.name}</h4>
                    <p>${this.formatFileSize(folder.size)} • ${folder.fileCount} files</p>
                    <p class="folder-path">${folder.relativePath}</p>
                </div>
                <div class="folder-actions">
                    <button onclick="uiManager.organizeFolder('${folder.path}')" class="btn-secondary">Organize</button>
                </div>
            </div>
        `).join('');

        // Display large files
        this.elements.largeFilesList.innerHTML = `<h3>Large Files</h3>` + analysis.largeFiles.map(file => `
            <div class="file-item">
                <div class="file-info">
                    <h4>${file.name}</h4>
                    <p>${this.formatFileSize(file.size)} • ${new Date(file.modified).toLocaleDateString()}</p>
                    <p class="file-path">${file.relativePath}</p>
                </div>
                <div class="file-actions">
                    <button onclick="uiManager.deleteFile('${file.path}')" class="btn-danger">Delete</button>
                </div>
            </div>
        `).join('');

        // Display system files
        this.elements.systemFilesList.innerHTML = `<h3>System Files</h3>` + analysis.systemFiles.map(file => `
            <div class="file-item system-file">
                <div class="file-info">
                    <h4>${file.name}</h4>
                    <p>${this.formatFileSize(file.size)}</p>
                    <p class="file-path">${file.relativePath}</p>
                </div>
                <div class="file-actions">
                    <button onclick="uiManager.deleteFile('${file.path}')" class="btn-danger">Delete</button>
                </div>
            </div>
        `).join('');

        // Display protected files
        this.elements.protectedFilesList.innerHTML = `<h3>Protected Files</h3>` + analysis.protectedFiles.map(file => `
            <div class="file-item protected-file">
                <div class="file-info">
                    <h4>${file.name}</h4>
                    <p>${this.formatFileSize(file.size)} • ${file.reason}</p>
                    <p class="file-path">${file.relativePath}</p>
                </div>
                <div class="file-actions">
                    <span class="protected-badge">Protected</span>
                </div>
            </div>
        `).join('');
    }

    async startOrganization() {
        if (!appState.analysis) {
            this.showNotification('Please scan a drive first', 'error');
            return;
        }

        if (appState.isOrganizing) {
            return;
        }

        appState.isOrganizing = true;
        this.showLoading('Organizing files...', true);

        try {
            const operations = this.generateOperations();
            const result = await ipcRenderer.invoke('organize-files', {
                drivePath: appState.currentDrive,
                operations,
                dryRun: appState.settings.dryRun
            });

            if (result.success) {
                this.displayOrganizationResults(result.data);
                this.showNotification(`Organization completed! ${result.data.summary.successful} operations successful.`, 'success');
            } else {
                this.showNotification(`Organization failed: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showNotification(`Organization error: ${error.message}`, 'error');
        } finally {
            appState.isOrganizing = false;
            this.hideLoading();
        }
    }

    generateOperations() {
        const operations = [];

        // Generate operations based on analysis
        if (appState.analysis) {
            // Move loose files to appropriate folders
            appState.analysis.folders.forEach(folder => {
                folder.looseFiles.forEach(file => {
                    if (file.name.includes('.') && !file.name.startsWith('.')) {
                        const extension = file.name.split('.').pop().toLowerCase();
                        const destinationFolder = this.getDestinationFolder(extension);
                        
                        if (destinationFolder) {
                            operations.push({
                                type: 'move',
                                source: path.join(folder.path, file.name),
                                destination: path.join(folder.path, destinationFolder, file.name)
                            });
                        }
                    }
                });
            });

            // Delete system files
            appState.analysis.systemFiles.forEach(file => {
                operations.push({
                    type: 'delete',
                    path: file.path
                });
            });
        }

        return operations;
    }

    getDestinationFolder(extension) {
        const folderMap = {
            'jpg': 'Images',
            'jpeg': 'Images',
            'png': 'Images',
            'gif': 'Images',
            'pdf': 'Documents',
            'doc': 'Documents',
            'docx': 'Documents',
            'txt': 'Documents',
            'mp4': 'Videos',
            'mov': 'Videos',
            'mp3': 'Audio',
            'wav': 'Audio'
        };
        return folderMap[extension] || null;
    }

    displayOrganizationResults(results) {
        this.elements.operationsList.innerHTML = `
            <div class="results-summary">
                <h3>Organization Results</h3>
                <p>Total operations: ${results.summary.total}</p>
                <p>Successful: ${results.summary.successful}</p>
                <p>Failed: ${results.summary.failed}</p>
            </div>
            <div class="operations-details">
                ${results.moved.length > 0 ? `
                    <h4>Moved Files (${results.moved.length})</h4>
                    ${results.moved.map(op => `
                        <div class="operation-item">
                            <span class="operation-type move">Move</span>
                            <span class="operation-path">${op.source} → ${op.destination}</span>
                        </div>
                    `).join('')}
                ` : ''}
                ${results.deleted.length > 0 ? `
                    <h4>Deleted Files (${results.deleted.length})</h4>
                    ${results.deleted.map(path => `
                        <div class="operation-item">
                            <span class="operation-type delete">Delete</span>
                            <span class="operation-path">${path}</span>
                        </div>
                    `).join('')}
                ` : ''}
                ${results.errors.length > 0 ? `
                    <h4>Errors (${results.errors.length})</h4>
                    ${results.errors.map(error => `
                        <div class="operation-item error">
                            <span class="operation-type error">Error</span>
                            <span class="operation-path">${error.path}: ${error.error}</span>
                        </div>
                    `).join('')}
                ` : ''}
            </div>
        `;
    }

    async findDuplicates() {
        if (!appState.currentDrive) {
            this.showNotification('Please select a drive path first', 'error');
            return;
        }

        this.showLoading('Finding duplicates...', true);

        try {
            const result = await ipcRenderer.invoke('find-duplicates', appState.currentDrive);
            
            if (result.success) {
                this.displayDuplicates(result.data);
                this.showNotification(`Found ${result.data.length} duplicates!`, 'success');
            } else {
                this.showNotification(`Duplicate search failed: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showNotification(`Duplicate search error: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    displayDuplicates(duplicates) {
        this.elements.duplicatesList.innerHTML = duplicates.map(duplicate => `
            <div class="duplicate-item">
                <div class="duplicate-info">
                    <h4>${path.basename(duplicate.duplicate)}</h4>
                    <p>${this.formatFileSize(duplicate.size)} • ${new Date(duplicate.modified).toLocaleDateString()}</p>
                    <p class="duplicate-path">${duplicate.relativePath}</p>
                    <p class="original-path">Original: ${duplicate.original}</p>
                </div>
                <div class="duplicate-actions">
                    <button onclick="uiManager.deleteFile('${duplicate.duplicate}')" class="btn-danger">Delete Duplicate</button>
                </div>
            </div>
        `).join('');
    }

    saveSettings() {
        const patterns = this.elements.protectedPatternsInput.value
            .split(',')
            .map(p => p.trim())
            .filter(p => p.length > 0);

        appState.updateSettings({
            protectedPatterns: patterns
        });

        this.showNotification('Settings saved successfully!', 'success');
    }

    // Utility methods
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showLoading(message, showProgress = false) {
        this.elements.scanStatus.textContent = message;
        this.elements.scanLoading.style.display = 'block';
        if (showProgress) {
            this.elements.scanProgress.style.width = '50%'; // Simulate progress
        }
    }

    hideLoading() {
        this.elements.scanLoading.style.display = 'none';
        this.elements.scanProgress.style.width = '0%';
        this.elements.scanStatus.textContent = '';
    }

    showNotification(message, type = 'info') {
        this.elements.notification.textContent = message;
        this.elements.notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            this.elements.notification.classList.remove('show');
        }, 3000);
    }

    async organizeFolder(folderPath) {
        if (confirm(`Are you sure you want to organize files in ${folderPath}?`)) {
            this.showNotification(`Organizing folder: ${folderPath}`, 'info');
            // Here you would typically call an IPC handler to trigger organization for a specific folder
            // For now, it's a placeholder
            console.log('Organizing folder:', folderPath);
        }
    }

    async deleteFile(filePath) {
        if (confirm(`Are you sure you want to delete ${filePath}? This action cannot be undone.`)) {
            this.showNotification(`Deleting file: ${filePath}`, 'info');
            try {
                const result = await ipcRenderer.invoke('delete-file', filePath);
                if (result.success) {
                    this.showNotification(`Successfully deleted: ${filePath}`, 'success');
                    // Optionally, re-scan or update UI to reflect deletion
                } else {
                    this.showNotification(`Failed to delete: ${filePath}. Error: ${result.error}`, 'error');
                }
            } catch (error) {
                this.showNotification(`Error deleting file: ${error.message}`, 'error');
            }
        }
    }
}

// Initialize app
const appState = new AppState();
const uiManager = new UIManager();

// Set default drive path
uiManager.elements.drivePathInput.value = '/Users/kapilthakare/Library/CloudStorage/GoogleDrive-kapilsthakare@gmail.com';
appState.currentDrive = uiManager.elements.drivePathInput.value;

// Show dashboard by default
uiManager.showSection('dashboard');
uiManager.updateUI();

// Export for global access
window.appState = appState;
window.uiManager = uiManager;