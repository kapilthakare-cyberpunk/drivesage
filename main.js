const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { google } = require('googleapis');

// App configuration
const APP_CONFIG = {
    name: 'DriveSage',
    version: '1.0.0',
    window: {
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 600
    },
    paths: {
        userData: app.getPath('userData'),
        logs: path.join(app.getPath('userData'), 'logs')
    }
};

// Global variables
let mainWindow;
let isDev = process.argv.includes('--dev');

// Logger utility
class Logger {
    static log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data
        };
        
        console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
        
        // In production, you might want to write to a log file
        if (!isDev) {
            this.writeToFile(logEntry);
        }
    }
    
    static info(message, data = null) {
        this.log('info', message, data);
    }
    
    static error(message, error = null) {
        this.log('error', message, error);
    }
    
    static warn(message, data = null) {
        this.log('warn', message, data);
    }
    
    static writeToFile(logEntry) {
        try {
            fs.ensureDirSync(APP_CONFIG.paths.logs);
            const logFile = path.join(APP_CONFIG.paths.logs, `${new Date().toISOString().split('T')[0]}.log`);
            fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }
}

// Drive analysis service
class DriveAnalysisService {
    static async analyzeDrive(drivePath) {
        Logger.info('Starting drive analysis', { drivePath });
        
        try {
            const analysis = {
                metadata: {
                    scanTime: new Date().toISOString(),
                    drivePath,
                    totalSize: 0,
                    fileCount: 0,
                    folderCount: 0
                },
                folders: [],
                largeFiles: [],
                duplicates: [],
                systemFiles: [],
                protectedFiles: [],
                errors: []
            };

            if (!await fs.pathExists(drivePath)) {
                throw new Error(`Drive path does not exist: ${drivePath}`);
            }

            await this.scanDirectory(drivePath, analysis);
            await this.findDuplicates(drivePath, analysis);
            
            Logger.info('Drive analysis completed', {
                fileCount: analysis.metadata.fileCount,
                folderCount: analysis.metadata.folderCount,
                totalSize: analysis.metadata.totalSize
            });
            
            return analysis;
        } catch (error) {
            Logger.error('Drive analysis failed', error);
            throw error;
        }
    }
    
    static async scanDirectory(dirPath, analysis, relativePath = '') {
        try {
            const items = await fs.readdir(dirPath);
            
            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const itemRelativePath = path.join(relativePath, item);
                
                try {
                    const stats = await fs.stat(itemPath);
                    
                    if (stats.isDirectory()) {
                        analysis.metadata.folderCount++;
                        const folderAnalysis = await this.analyzeFolder(itemPath, item, itemRelativePath);
                        analysis.folders.push(folderAnalysis);
                        await this.scanDirectory(itemPath, analysis, itemRelativePath);
                    } else {
                        analysis.metadata.fileCount++;
                        analysis.metadata.totalSize += stats.size;
                        
                        // Check for large files
                        if (stats.size > 100 * 1024 * 1024) { // 100MB
                            analysis.largeFiles.push({
                                name: item,
                                path: itemPath,
                                relativePath: itemRelativePath,
                                size: stats.size,
                                modified: stats.mtime
                            });
                        }
                        
                        // Check for system files
                        if (this.isSystemFile(item)) {
                            analysis.systemFiles.push({
                                name: item,
                                path: itemPath,
                                relativePath: itemRelativePath,
                                size: stats.size
                            });
                        }
                        
                        // Check for protected files
                        if (this.isProtectedFile(item)) {
                            analysis.protectedFiles.push({
                                name: item,
                                path: itemPath,
                                relativePath: itemRelativePath,
                                size: stats.size,
                                reason: 'Potential AI/code related file'
                            });
                        }
                    }
                } catch (error) {
                    analysis.errors.push({
                        path: itemPath,
                        error: error.message
                    });
                    Logger.warn(`Error processing item: ${itemPath}`, error);
                }
            }
        } catch (error) {
            Logger.error(`Error scanning directory: ${dirPath}`, error);
            throw error;
        }
    }
    
    static async analyzeFolder(folderPath, folderName, relativePath) {
        const folderAnalysis = {
            name: folderName,
            path: folderPath,
            relativePath,
            size: 0,
            fileCount: 0,
            subfolders: [],
            looseFiles: [],
            lastModified: null
        };

        try {
            const items = await fs.readdir(folderPath);
            
            for (const item of items) {
                const itemPath = path.join(folderPath, item);
                const stats = await fs.stat(itemPath);
                
                if (stats.isDirectory()) {
                    folderAnalysis.subfolders.push(item);
                } else {
                    folderAnalysis.fileCount++;
                    folderAnalysis.size += stats.size;
                    folderAnalysis.looseFiles.push({
                        name: item,
                        size: stats.size,
                        modified: stats.mtime
                    });
                    
                    if (!folderAnalysis.lastModified || stats.mtime > folderAnalysis.lastModified) {
                        folderAnalysis.lastModified = stats.mtime;
                    }
                }
            }
        } catch (error) {
            Logger.error(`Error analyzing folder: ${folderPath}`, error);
            throw error;
        }
        
        return folderAnalysis;
    }
    
    static async findDuplicates(drivePath, analysis) {
        Logger.info('Starting duplicate detection');
        
        const fileHashes = new Map();
        const duplicates = [];
        
        try {
            await this.scanForDuplicates(drivePath, fileHashes, duplicates);
            analysis.duplicates = duplicates;
            
            Logger.info(`Duplicate detection completed. Found ${duplicates.length} duplicates`);
        } catch (error) {
            Logger.error('Duplicate detection failed', error);
            throw error;
        }
    }
    
    static async scanForDuplicates(dirPath, fileHashes, duplicates, relativePath = '') {
        try {
            const items = await fs.readdir(dirPath);
            
            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const itemRelativePath = path.join(relativePath, item);
                
                try {
                    const stats = await fs.stat(itemPath);
                    
                    if (stats.isDirectory()) {
                        await this.scanForDuplicates(itemPath, fileHashes, duplicates, itemRelativePath);
                    } else {
                        // Simple hash based on filename and size for now
                        // In production, you might want to use content hashing
                        const hash = `${item}_${stats.size}`;
                        
                        if (fileHashes.has(hash)) {
                            duplicates.push({
                                original: fileHashes.get(hash),
                                duplicate: itemPath,
                                relativePath: itemRelativePath,
                                size: stats.size,
                                modified: stats.mtime
                            });
                        } else {
                            fileHashes.set(hash, itemPath);
                        }
                    }
                } catch (error) {
                    Logger.warn(`Error processing item for duplicates: ${itemPath}`, error);
                }
            }
        } catch (error) {
            Logger.error(`Error scanning for duplicates: ${dirPath}`, error);
            throw error;
        }
    }
    
    static isSystemFile(filename) {
        const systemFiles = ['.DS_Store', 'Thumbs.db', '.Spotlight-V100', '.fseventsd'];
        return systemFiles.includes(filename);
    }
    
    static isProtectedFile(filename) {
        const protectedPatterns = ['gemini', 'ai', 'assistant', 'code', 'project'];
        const lowerFilename = filename.toLowerCase();
        return protectedPatterns.some(pattern => lowerFilename.includes(pattern));
    }
}

// File organization service
class FileOrganizationService {
    static async organizeFiles(drivePath, operations, dryRun = true) {
        Logger.info('Starting file organization', { drivePath, operationsCount: operations.length, dryRun });
        
        const results = {
            moved: [],
            deleted: [],
            renamed: [],
            errors: [],
            summary: {
                total: operations.length,
                successful: 0,
                failed: 0
            }
        };

        for (const operation of operations) {
            try {
                await this.executeOperation(operation, results, dryRun);
                results.summary.successful++;
            } catch (error) {
                results.errors.push({
                    operation: operation.type,
                    path: operation.source || operation.path,
                    error: error.message
                });
                results.summary.failed++;
                Logger.error(`Operation failed: ${operation.type}`, error);
            }
        }
        
        Logger.info('File organization completed', results.summary);
        return results;
    }
    
    static async executeOperation(operation, results, dryRun) {
        switch (operation.type) {
            case 'move':
                if (!dryRun) {
                    await fs.move(operation.source, operation.destination);
                }
                results.moved.push({
                    source: operation.source,
                    destination: operation.destination
                });
                Logger.info(`File moved: ${operation.source} → ${operation.destination}`, { dryRun });
                break;
                
            case 'delete':
                if (!dryRun) {
                    await fs.remove(operation.path);
                }
                results.deleted.push(operation.path);
                Logger.info(`File deleted: ${operation.path}`, { dryRun });
                break;
                
            case 'rename':
                if (!dryRun) {
                    await fs.move(operation.oldPath, operation.newPath);
                }
                results.renamed.push({
                    oldPath: operation.oldPath,
                    newPath: operation.newPath
                });
                Logger.info(`File renamed: ${operation.oldPath} → ${operation.newPath}`, { dryRun });
                break;
                
            default:
                throw new Error(`Unknown operation type: ${operation.type}`);
        }
    }
}

// Window management
function createWindow() {
    Logger.info('Creating main window');
    
    mainWindow = new BrowserWindow({
        ...APP_CONFIG.window,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        icon: path.join(__dirname, 'assets/icon.png'),
        titleBarStyle: 'hiddenInset',
        show: false,
        webSecurity: false // For local file access
    });

    mainWindow.loadFile('index.html');
    
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        Logger.info('Main window ready');
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        Logger.info('Main window closed');
    });

    // Open DevTools in development
    if (isDev) {
        mainWindow.webContents.openDevTools();
        Logger.info('DevTools opened (development mode)');
    }
}

// App lifecycle
app.whenReady().then(() => {
    Logger.info('App ready, creating window');
    createWindow();
    createMenu();
});

app.on('window-all-closed', () => {
    Logger.info('All windows closed');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    Logger.info('App activated');
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', () => {
    Logger.info('App quitting');
});

// Menu creation
function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Scan Drive',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        mainWindow.webContents.send('menu-scan-drive');
                    }
                },
                {
                    label: 'Settings',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                        mainWindow.webContents.send('menu-open-settings');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Quit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About DriveSage',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About DriveSage',
                            message: `${APP_CONFIG.name} v${APP_CONFIG.version}`,
                            detail: 'Smart Google Drive Organization Tool\n\nMade with ❤️ for better file organization'
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// IPC Handlers
ipcMain.handle('analyze-drive', async (event, drivePath) => {
    try {
        const analysis = await DriveAnalysisService.analyzeDrive(drivePath);
        return { success: true, data: analysis };
    } catch (error) {
        Logger.error('IPC analyze-drive failed', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('organize-files', async (event, { drivePath, operations, dryRun }) => {
    try {
        const results = await FileOrganizationService.organizeFiles(drivePath, operations, dryRun);
        return { success: true, data: results };
    } catch (error) {
        Logger.error('IPC organize-files failed', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('find-duplicates', async (event, drivePath) => {
    try {
        const analysis = await DriveAnalysisService.analyzeDrive(drivePath);
        return { success: true, data: analysis.duplicates };
    } catch (error) {
        Logger.error('IPC find-duplicates failed', error);
        return { success: false, error: error.message };
    }
});

// Error handling
process.on('uncaughtException', (error) => {
    Logger.error('Uncaught exception', error);
    dialog.showErrorBox('DriveSage Error', `An unexpected error occurred:\n${error.message}`);
});

process.on('unhandledRejection', (reason, promise) => {
    Logger.error('Unhandled rejection', { reason, promise });
}); 