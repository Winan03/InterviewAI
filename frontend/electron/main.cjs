const { app, BrowserWindow, desktopCapturer, ipcMain, session, screen, nativeImage, globalShortcut, Tray, Menu } = require('electron');
const path = require('path');

let mainWindow;
let snipWindow = null;
let capturedScreenshot = null; // Full-screen NativeImage
let tray = null;

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
        skipTaskbar: true,
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

// ─── SNIPPING TOOL ───

ipcMain.on('start-snip', async () => {
    if (snipWindow) return; // Already snipping

    try {
        // 1. Hide the main window so it doesn't appear in the capture
        if (mainWindow) {
            mainWindow.hide();
        }

        // 2. Wait a moment for the window to fully hide
        await new Promise(resolve => setTimeout(resolve, 300));

        // 3. Capture the full screen
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.size;
        const scaleFactor = primaryDisplay.scaleFactor || 1;

        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: {
                width: Math.round(width * scaleFactor),
                height: Math.round(height * scaleFactor)
            }
        });

        if (!sources || sources.length === 0) {
            console.error('No screen sources found');
            if (mainWindow) mainWindow.show();
            return;
        }

        capturedScreenshot = sources[0].thumbnail;
        const screenshotDataUrl = capturedScreenshot.toDataURL();

        // 4. Create the fullscreen snip overlay window
        snipWindow = new BrowserWindow({
            fullscreen: true,
            frame: false,
            transparent: false,
            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: false,
            movable: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
            }
        });

        // Stealth: invisible in screen share / Zoom
        snipWindow.setContentProtection(true);

        snipWindow.loadFile(path.join(__dirname, 'snip.html'));

        snipWindow.webContents.on('did-finish-load', () => {
            // Send the screenshot to the overlay
            snipWindow.webContents.send('set-screenshot', screenshotDataUrl);
        });

        snipWindow.on('closed', () => {
            snipWindow = null;
        });

    } catch (err) {
        console.error('Error starting snip:', err);
        if (mainWindow) mainWindow.show();
    }
});

// Snip completed — crop and send back to renderer
ipcMain.on('snip-complete', (event, region) => {
    try {
        if (capturedScreenshot && region.width > 0 && region.height > 0) {
            // Crop the captured screenshot to the selected region
            const cropped = capturedScreenshot.crop({
                x: region.x,
                y: region.y,
                width: region.width,
                height: region.height,
            });

            const croppedDataUrl = cropped.toDataURL();

            // Send the cropped image back to the main renderer
            if (mainWindow) {
                mainWindow.webContents.send('snip-result', croppedDataUrl);
            }
        }
    } catch (err) {
        console.error('Error cropping snip:', err);
    } finally {
        // Close snip overlay and restore main window
        if (snipWindow) {
            snipWindow.close();
            snipWindow = null;
        }
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
        capturedScreenshot = null;
    }
});

// Snip cancelled
ipcMain.on('snip-cancel', () => {
    if (snipWindow) {
        snipWindow.close();
        snipWindow = null;
    }
    if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
    }
    capturedScreenshot = null;
});


// ─── TOGGLE WINDOW VISIBILITY ───
function toggleWindow() {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
        mainWindow.hide();
    } else {
        mainWindow.show();
        mainWindow.focus();
    }
}

app.whenReady().then(() => {
    createWindow();

    // ─── GLOBAL SHORTCUT: Ctrl+Shift+Space to toggle window ───
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
        toggleWindow();
    });

    // ─── SYSTEM TRAY (discreet icon near the clock) ───
    // Create a small 16x16 icon for the tray
    const trayIcon = nativeImage.createEmpty();
    // Create a minimal 16x16 cyan dot as tray icon
    const size = 16;
    const canvas = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAARklEQVQ4T2NkYPj/n4EBBBgZGRn+MzAwMIIYIAaYDOI/AwMDA4yPIoYuBzYAZgDMIJgamBhMHGYAdXwxagBl4UBhOFAfDAB6jQ8R1R1GOAAAAABJRU5ErkJggg==`;
    const icon = nativeImage.createFromDataURL(canvas);

    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    tray.setToolTip('VozInterview (Ctrl+Shift+Space)');

    const trayMenu = Menu.buildFromTemplate([
        {
            label: '👁 Mostrar / Ocultar',
            click: toggleWindow,
        },
        { type: 'separator' },
        {
            label: '❌ Salir',
            click: () => {
                app.isQuitting = true;
                app.quit();
            },
        },
    ]);
    tray.setContextMenu(trayMenu);

    // Click tray icon to toggle window
    tray.on('click', toggleWindow);

    // Allow desktop audio capture permissions
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
        return true;
    });

    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(true);
    });
});

// Clean up global shortcuts on quit
app.on('will-quit', () => {
    globalShortcut.unregisterAll();
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
