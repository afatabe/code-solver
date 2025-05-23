import { BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';
import { PATHS } from '../config/paths';
import { CONSTANTS } from '../config/constants';
import { readApiKeyFromFile, saveApiKeyToFile } from '../services/storageService';
import { initializeGemini } from '../services/geminiService';
import { getMainWindow } from './mainWindow';

let apiKeyWindow: BrowserWindow | null = null;

function removeApiKeyListeners(): void {
  ipcMain.removeAllListeners('submit-api-key');
}

async function validateAndSaveApiKey(apiKey: string): Promise<boolean> {
  try {
    const isValid = await initializeGemini(apiKey);
    if (isValid) {
      saveApiKeyToFile(apiKey);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error validating API key:', error);
    return false;
  }
}

export function requestApiKey(): Promise<string | null> {
  const savedKey = readApiKeyFromFile();
  
  return new Promise((resolve) => {
    if (apiKeyWindow && !apiKeyWindow.isDestroyed()) {
      apiKeyWindow.focus();
      return;
    }

    apiKeyWindow = new BrowserWindow({
      width: CONSTANTS.WINDOW.API_KEY.WIDTH,
      height: CONSTANTS.WINDOW.API_KEY.HEIGHT,
      resizable: false,
      minimizable: false,
      maximizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      icon: path.join(PATHS.ASSETS, 'icon.ico')
    });

    apiKeyWindow.loadFile(path.join(PATHS.PUBLIC, 'api-key.html'));
    apiKeyWindow.setMenu(null);

    if (savedKey) {
      apiKeyWindow.webContents.once('did-finish-load', () => {
        apiKeyWindow?.webContents.send('load-saved-key', savedKey);
      });
    }

    apiKeyWindow.setVisibleOnAllWorkspaces(true);
    apiKeyWindow.focus();

    removeApiKeyListeners();

    const submitHandler = async (event: Electron.IpcMainEvent, apiKey: string) => {
      if (apiKey) {
        const isValid = await validateAndSaveApiKey(apiKey);
        if (isValid) {
          apiKeyWindow?.close();
          resolve(apiKey);
        } else {
          event.reply('api-key-error', 'Invalid API key. Please check and try again.');
        }
      }
    };

    ipcMain.on('submit-api-key', submitHandler);

    apiKeyWindow.on('closed', () => {
      ipcMain.removeListener('submit-api-key', submitHandler);
      apiKeyWindow = null;
      resolve(null);
    });
  });
}

export function createApiKeyWindow(): BrowserWindow | null {
  console.log('Creating API key window...');
  
  if (apiKeyWindow && !apiKeyWindow.isDestroyed()) {
    console.log('API key window already exists, focusing...');
    apiKeyWindow.focus();
    return apiKeyWindow;
  }

  const savedKey = readApiKeyFromFile();
  const mainWindow = getMainWindow();
  console.log('Main window status:', mainWindow ? 'Exists' : 'Not found');
  
  const windowOptions = {
    width: CONSTANTS.WINDOW.API_KEY.WIDTH,
    height: CONSTANTS.WINDOW.API_KEY.HEIGHT,
    resizable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    show: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(PATHS.ASSETS, 'icon.ico')
  };

  try {
    apiKeyWindow = new BrowserWindow(windowOptions);
    console.log('API key window created successfully');
  } catch (error) {
    console.error('Error creating API key window:', error);
    return null;
  }

  apiKeyWindow.setContentProtection(true);
  apiKeyWindow.setVisibleOnAllWorkspaces(true);
  apiKeyWindow.setAlwaysOnTop(true, 'screen-saver');
  apiKeyWindow.loadFile(path.join(PATHS.PUBLIC, 'api-key.html'));
  apiKeyWindow.setMenu(null);

  if (savedKey) {
    apiKeyWindow.webContents.once('did-finish-load', () => {
      console.log('Loading saved API key...');
      apiKeyWindow?.webContents.send('load-saved-key', savedKey);
    });
  }

  apiKeyWindow.once('ready-to-show', () => {
    console.log('API key window ready to show...');
    apiKeyWindow?.show();
    apiKeyWindow?.focus();
  });

  removeApiKeyListeners();

  const submitHandler = async (event: Electron.IpcMainEvent, apiKey: string) => {
    if (apiKey) {
      const isValid = await validateAndSaveApiKey(apiKey);
      if (isValid) {
        apiKeyWindow?.close();
      } else {
        event.reply('api-key-error', 'Invalid API key. Please check and try again.');
      }
    }
  };

  ipcMain.on('submit-api-key', submitHandler);

  apiKeyWindow.on('closed', () => {
    console.log('API key window closed');
    ipcMain.removeListener('submit-api-key', submitHandler);
    apiKeyWindow = null;
  });

  return apiKeyWindow;
} 