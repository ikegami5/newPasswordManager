export const applicationName = 'New Password Manager';
export {
  generateLegacyPc,
  legacyHash,
  LegacyGenerationError,
} from './legacy/generator';
export type { LegacyConditions, Sha512 } from './legacy/generator';
export { parseLegacyPc } from './legacy/parser';
export type {
  LegacyRecord,
  LegacyDiagnostic,
  LegacyParseResult,
} from './legacy/parser';
export {
  DocumentError,
  validateDocument,
  parseDocument,
  serializeDocument,
  migrateLegacyRecords,
} from './model/document';
export type { DataDocument, ServiceRecord } from './model/document';
