const { app, BrowserWindow, shell, Menu, Tray, nativeImage, desktopCapturer } = require('electron');
const path = require('path');


// Basic app setup
const trayIcon = nativeImage.createEmpty();

let tray = null;
let mainWindow = null;
let isQuitting = false;

// Performance and Feature Flags
app.commandLine.appendSwitch('enable-features', 'WebRTC-H264WithOpenH264FFmpeg,DesktopCaptureTimerRepo,WebRTCPipeWireCapturer,WaylandWindowDecorations');
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
app.commandLine.appendSwitch('enable-usermedia-screen-capturing');
app.commandLine.appendSwitch('enable-media-stream', 'true');
app.commandLine.appendSwitch('disable-features', 'GpuProcessHighPriority'); // Try to prevent some GPU crashes without full disable
app.commandLine.appendSwitch('disable-gpu-memory-buffer-video-frames');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-breakpad');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-domain-reliability');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('memory-model', 'low');

/*
// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            if (!mainWindow.isVisible()) mainWindow.show();
            mainWindow.focus();
        }
    });

    app.whenReady().then(() => {
        createWindow();
        createTray();

        app.on('activate', function () {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });
}
*/

// For debugging: skip single instance lock
app.whenReady().then(() => {
    createWindow();
    createTray();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

function createTray() {
    // Attempt to use system icon or default to empty
    // In a real app, you should bundle an icon.png
    const iconPath = path.join(__dirname, 'build/icon.png');
    // If no icon found, Tray might show empty space. 
    // Electron usually requires an image. We use a simple fallback if needed or let it be.
    // For this environment, we'll try to use a standard path or just proceed.
    // Use nativeImage.createEmpty() if we really don't have one, but we prefer something visible.
    // We'll rely on the default app icon if specific tray icon is missing.

    // Using a 1x1 transparent pixel or similar if absolutely needed, but let's try a generic approach.
    // Note: If image is invalid, Tray might throw.
    // We'll trust that the user/system handles the default icon or we add one later.
    // For now, let's create a minimal tray.

    // FIX: To avoid crash on missing icon, we'll use a data URI or empty image?
    // Better: let's try to assume 'icon.png' exists in root if user put it there, else use empty.

    tray = new Tray(nativeImage.createEmpty());
    // Ideally we update this with a real icon.
    // tray.setImage(nativeImage.createFromPath('/path/to/icon.png'));

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show App',
            click: () => {
                mainWindow.show();
            }
        },
        {
            label: 'Quit',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Microsoft Teams');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
        }
    });
}

function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Quit',
                    click: () => {
                        isQuitting = true;
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'pasteAndMatchStyle' },
                { role: 'delete' },
                { role: 'selectAll' }
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
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                { role: 'close' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'Microsoft Teams',
        backgroundColor: '#2b2b2b', // Dark theme background
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false, // Disabled for device access on Linux
            backgroundThrottling: true,
            autoplayPolicy: 'no-user-gesture-required'
        }
    });

    createMenu();

    // Permission handling
    mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
        console.log(`[DEBUG] Permission check: ${permission} for ${requestingOrigin}`);
        const allowedPermissions = [
            'media', 'geolocation', 'notifications', 'midi', 'camera',
            'microphone', 'fullscreen', 'pointerLock', 'display-capture',
            'window-management', 'audio-capture', 'mediaKeySystem'
        ];

        if (allowedPermissions.includes(permission)) {
            return true;
        }

        try {
            const url = new URL(requestingOrigin);
            const host = url.hostname;
            if (host.endsWith('.microsoft.com') ||
                host.endsWith('.teams.microsoft.com') ||
                host.endsWith('.live.com') ||
                host.endsWith('.microsoftonline.com') ||
                host.endsWith('.skype.com')) {
                return true;
            }
        } catch (e) {
            // Fallback for weird origins
        }
        return false;
    });

    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        console.log(`[DEBUG] Permission request: ${permission} for ${webContents.getURL()}`);
        const allowedPermissions = [
            'media', 'camera', 'microphone', 'display-capture',
            'notifications', 'window-management', 'audio-capture', 'mediaKeySystem'
        ];

        if (allowedPermissions.includes(permission)) {
            return callback(true);
        }

        const urlString = webContents.getURL();
        try {
            const url = new URL(urlString);
            const host = url.hostname;
            if (host.endsWith('.microsoft.com') ||
                host.endsWith('.teams.microsoft.com') ||
                host.endsWith('.live.com') ||
                host.endsWith('.microsoftonline.com') ||
                host.endsWith('.skype.com')) {
                return callback(true);
            }
        } catch (e) {
            // Fallback
        }
        callback(false);
    });

    // Handle Screenshare (getDisplayMedia)
    mainWindow.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
        console.log(`[DEBUG] DisplayMediaRequestHandler triggered: video=${request.videoRequested}, audio=${request.audioRequested}`);

        desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
            console.log(`[DEBUG] desktopCapturer found ${sources.length} sources`);

            if (sources.length === 0) {
                console.error('[DEBUG] No sources found for screenshare');
                return callback(null);
            }

            // If only one source (usually the screen), we can either auto-select or show menu
            // Let's show a menu to remain flexible as requested
            const menuTemplate = sources.map(source => ({
                label: source.name || 'Unknown Source',
                click: () => {
                    console.log(`[DEBUG] User selected source: ${source.name} (ID: ${source.id})`);
                    callback({ video: source, audio: request.audioRequested ? 'loopback' : undefined });
                }
            }));

            menuTemplate.push({ type: 'separator' });
            menuTemplate.push({
                label: 'Cancel',
                click: () => {
                    console.log('[DEBUG] Screenshare selection cancelled');
                    callback(null);
                }
            });

            const selectionMenu = Menu.buildFromTemplate(menuTemplate);

            // Popup on the main window
            selectionMenu.popup({ window: mainWindow });

        }).catch(err => {
            console.error('[DEBUG] Error getting sources:', err);
            callback(null);
        });
    });

    // Set User-Agent to Windows Chrome to potentially bypass Linux-specific blocks
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    mainWindow.webContents.setUserAgent(userAgent);

    mainWindow.loadURL('https://teams.microsoft.com');

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https://teams.microsoft.com')) {
            return { action: 'allow' };
        }
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Handle close event to minimize to tray
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            return false;
        }
    });
}
