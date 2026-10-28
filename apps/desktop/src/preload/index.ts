import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi } from '../shared/api';

const api: DesktopApi = {
  loadState: () => ipcRenderer.invoke('newpm:loadState'),
  reload: () => ipcRenderer.invoke('newpm:reload'),
  generate: (serviceId, saltId, master) =>
    ipcRenderer.invoke('newpm:generate', serviceId, saltId, master),
  register: (input) => ipcRenderer.invoke('newpm:register', input),
  appendSalt: (serviceId) => ipcRenderer.invoke('newpm:appendSalt', serviceId),
  previewLegacyImport: () => ipcRenderer.invoke('newpm:previewLegacyImport'),
  commitImport: (token) => ipcRenderer.invoke('newpm:commitImport', token),
};
contextBridge.exposeInMainWorld('newpm', api);
