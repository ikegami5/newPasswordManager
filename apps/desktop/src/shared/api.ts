export interface PublicService {
  id: string;
  serviceName: string;
  serviceInfo: string;
  salts: { id: string; label: string }[];
}

export interface ClipboardStatus {
  state: 'idle' | 'copied' | 'cleared' | 'changed' | 'failed';
  expiresAt?: number;
}

export type PublicState = {
  clipboard: ClipboardStatus;
} & (
  | { status: 'ready'; records: PublicService[] }
  | { status: 'error'; error: string }
);

export interface ImportPreview {
  token: string;
  records: number;
  salts: number;
}

export type Result<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      error: string;
      diagnostics?: { line: number; code: string }[];
    };

export interface RegistrationInput {
  serviceName: string;
  serviceInfo: string;
  hasCapital: boolean;
  hasNumeral: boolean;
  symbols: string;
  passwordLength: number;
}

export interface DesktopApi {
  loadState(): Promise<Result<PublicState>>;
  reload(): Promise<Result<PublicState>>;
  generate(
    serviceId: string,
    saltId: string,
    master: string,
  ): Promise<Result<PublicState>>;
  appendSalt(serviceId: string): Promise<Result<PublicState>>;
  register(input: RegistrationInput): Promise<Result<PublicState>>;
  previewLegacyImport(): Promise<Result<ImportPreview | null>>;
  commitImport(token: string): Promise<Result<PublicState>>;
}
