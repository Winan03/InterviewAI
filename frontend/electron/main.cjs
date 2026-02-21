const { app, BrowserWindow, desktopCapturer, ipcMain, session } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 520,
        height: 450,
        minWidth: 400,
        minHeight: 250,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: true,
        minimizable: true,
        skipTaskbar: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            devTools: true
        }
    });

    // Load the app
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Keep window always on top
    mainWindow.setAlwaysOnTop(true, 'floating');
    mainWindow.setVisibleOnAllWorkspaces(true);

    // Stealth Mode: Hide window from screen capture, screen share and screenshots
    // Uses Windows API WDA_EXCLUDEFROMCAPTURE (Windows 10 2004+)
    mainWindow.setContentProtection(true);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ─── IPC Handlers ───

// Window controls
ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
});

ipcMain.on('window-toggle-pin', (event) => {
    if (mainWindow) {
        const isOnTop = mainWindow.isAlwaysOnTop();
        mainWindow.setAlwaysOnTop(!isOnTop, 'floating');
        event.reply('window-pin-changed', !isOnTop);
    }
});

ipcMain.on('window-compact', () => {
    if (mainWindow) {
        mainWindow.setSize(420, 120);
    }
});

ipcMain.on('window-expand', () => {
    if (mainWindow) {
        mainWindow.setSize(520, 450);
    }
});

// Desktop capturer - get available sources
ipcMain.handle('get-desktop-sources', async () => {
    try {
        const sources = await desktopCapturer.getSources({
            types: ['screen', 'window'],
            thumbnailSize: { width: 0, height: 0 }
        });
        return sources.map(s => ({ id: s.id, name: s.name }));
    } catch (err) {
        console.error('Error getting desktop sources:', err);
        return [];
    }
});

app.whenReady().then(() => {
    createWindow();

    // Allow desktop audio capture permissions
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
        return true;
    });

    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(true);
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
