export const maximumFileBytes = 10 * 1024 * 1024;

export class MobileError extends Error {
  constructor(
    public readonly code: string,
    public readonly diagnostics?: { line: number; code: string }[],
  ) {
    super(code);
    this.name = 'MobileError';
  }
}

export interface MobileClipboardState {
  state: 'idle' | 'copied' | 'cleared' | 'changed' | 'failed';
  remainingSeconds: number;
}

export interface MobileState {
  status: 'ready' | 'error';
  error?: string;
  records: {
    id: string;
    serviceName: string;
    serviceInfo: string;
    salts: { id: string; label: string }[];
  }[];
  clipboard: MobileClipboardState;
}

export interface MobilePreview {
  token: string;
  records: number;
  salts: number;
  added: number;
  removed: number;
  changed: number;
  lostSalts: number;
  replacing: boolean;
  recovering: boolean;
}
