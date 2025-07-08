const { ipcRenderer } = require('electron');
const path = require('path'); // Added missing import for path

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
        this.updateUI();
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
        // Main sections
        this.elements.dashboard = document.getElementById('dashboard');
        this.elements.scanSection = document.getElementById('scan-section');
        this.elements.analysisSection = document.getElementById('analysis-section');
        this.elements.organizeSection = document.getElementById('organize-section');
        this.elements.duplicatesSection = document.getElementById('duplicates-section');
        this.elements.settingsSection = document.getElementById('settings-section');

        // Dashboard elements
        this.elements.drivePathInput = document.getElementById('drive-path');
        this.elements.scanButton = document.getElementById('scan-btn');
        this.elements.quickStats = document.getElementById('quick-stats');
        this.elements.recentActivity = document.getElementById('recent-activity');

        // Analysis elements
        this.elements.folderList = document.getElementById('folder-list');
        this.elements.largeFilesList = document.getElementById('large-files-list');
        this.elements.systemFilesList = document.getElementById('system-files-list');
        this.elements.protectedFilesList = document.getElementById('protected-files-list');

        // Organization elements
        this.elements.organizeButton = document.getElementById('organize-btn');
        this.elements.dryRunToggle = document.getElementById('dry-run-toggle');
        this.elements.operationsList = document.getElementById('operations-list');

        // Duplicates elements
        this.elements.duplicatesList = document.getElementById('duplicates-list');
        this.elements.findDuplicatesButton = document.getElementById('find-duplicates-btn');

        // Settings elements
        this.elements.autoBackupToggle = document.getElementById('auto-backup-toggle');
        this.elements.protectedPatternsInput = document.getElementById('protected-patterns');
        this.elements.saveSettingsButton = document.getElementById('save-settings-btn');

        // Progress and status
        this.elements.progressBar = document.getElementById('progress-bar');
        this.elements.statusText = document.getElementById('status-text');
        this.elements.loadingSpinner = document.getElementById('loading-spinner');
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.showSection(e.target.dataset.section);
            });
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
            this.startScan();
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
        Object.values(this.elements).forEach(element => {
            if (element && element.classList && element.classList.contains('section')) {
                element.style.display = 'none';
            }
        });

        // Show selected section
        const targetSection = this.elements[`${sectionName}Section`];
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
            this.showError('Please select a drive path first');
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
                this.showSuccess('Drive analysis completed successfully!');
                this.showSection('analysis');
            } else {
                this.showError(`Scan failed: ${result.error}`);
            }
        } catch (error) {
            this.showError(`Scan error: ${error.message}`);
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
                <h3>${analysis.folders.length}</h3>
                <p>Top-level Folders</p>
            </div>
        `;

        // Display folders
        this.elements.folderList.innerHTML = analysis.folders.map(folder => `
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
        this.elements.largeFilesList.innerHTML = analysis.largeFiles.map(file => `
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
        this.elements.systemFilesList.innerHTML = analysis.systemFiles.map(file => `
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
        this.elements.protectedFilesList.innerHTML = analysis.protectedFiles.map(file => `
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
            this.showError('Please scan a drive first');
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
                this.showSuccess(`Organization completed! ${result.data.summary.successful} operations successful.`);
            } else {
                this.showError(`Organization failed: ${result.error}`);
            }
        } catch (error) {
            this.showError(`Organization error: ${error.message}`);
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
            this.showError('Please select a drive path first');
            return;
        }

        this.showLoading('Finding duplicates...', true);

        try {
            const result = await ipcRenderer.invoke('find-duplicates', appState.currentDrive);
            
            if (result.success) {
                this.displayDuplicates(result.data);
                this.showSuccess(`Found ${result.data.length} duplicates!`);
            } else {
                this.showError(`Duplicate search failed: ${result.error}`);
            }
        } catch (error) {
            this.showError(`Duplicate search error: ${error.message}`);
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

        this.showSuccess('Settings saved successfully!');
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
        this.elements.statusText.textContent = message;
        this.elements.loadingSpinner.style.display = 'block';
        this.elements.progressBar.style.display = showProgress ? 'block' : 'none';
    }

    hideLoading() {
        this.elements.loadingSpinner.style.display = 'none';
        this.elements.progressBar.style.display = 'none';
        this.elements.statusText.textContent = '';
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // Action methods
    organizeFolder(folderPath) {
        // Implementation for organizing a specific folder
        console.log('Organizing folder:', folderPath);
    }

    deleteFile(filePath) {
        if (confirm('Are you sure you want to delete this file?')) {
            // Implementation for deleting a file
            console.log('Deleting file:', filePath);
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