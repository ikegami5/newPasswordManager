import type { LegacyConditions } from './generator';

export interface LegacyRecord extends LegacyConditions {
  serviceName: string;
  serviceInfo: string;
  /** Latest first; file order is reversed exactly once here. */
  salts: string[];
}

export interface LegacyDiagnostic {
  line: number;
  code:
    | 'empty-line'
    | 'field-count'
    | 'empty-name'
    | 'duplicate-name'
    | 'invalid-boolean'
    | 'invalid-length'
    | 'missing-salt'
    | 'ambiguous-escape';
}

export type LegacyParseResult =
  | { ok: true; records: LegacyRecord[] }
  | { ok: false; diagnostics: LegacyDiagnostic[] };

// Java/Scala String.trim only removes characters <= U+0020, unlike JS trim.
function pcTrim(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value.charCodeAt(start) <= 32) start++;
  while (end > start && value.charCodeAt(end - 1) <= 32) end--;
  return value.slice(start, end);
}

/** Pure preview parser. Never returns partial records on failure or echoes raw rows. */
export function parseLegacyPc(text: string): LegacyParseResult {
  const lines = text.replace(/\r\n|\r/g, '\n').split('\n');
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  const records: LegacyRecord[] = [];
  const diagnostics: LegacyDiagnostic[] = [];
  const names = new Set<string>();
  lines.forEach((line, index) => {
    const report = (code: LegacyDiagnostic['code']): void => {
      diagnostics.push({ line: index + 1, code });
    };
    if (!pcTrim(line)) return report('empty-line');
    const fields = line.split(',').map(pcTrim);
    if (fields.length < 7) return report('field-count');
    const [name, info, capital, numeral, symbols, length, ...salts] = fields;
    const start = diagnostics.length;
    // A literal backslash adjacent to an escape cannot be distinguished from
    // the old writer's encoded text. Require user review instead of guessing.
    for (const [value, allowed] of [
      [name, 'C'],
      [info, 'Cn'],
      [symbols, 'SC'],
    ]) {
      if (
        /\\\\[CSn]/.test(value) ||
        /\\[CSn]/g.test(value.replace(new RegExp(`\\\\[${allowed}]`, 'g'), ''))
      ) {
        report('ambiguous-escape');
        break;
      }
    }
    const serviceName = name.replaceAll('\\C', ',');
    if (!serviceName) report('empty-name');
    if (names.has(serviceName)) report('duplicate-name');
    names.add(serviceName);
    if (!/^(true|false)$/i.test(capital) || !/^(true|false)$/i.test(numeral)) {
      report('invalid-boolean');
    }
    if (
      !/^[+-]?\d+$/.test(length) ||
      Number(length) < 1 ||
      Number(length) > 64
    ) {
      report('invalid-length');
    }
    if (salts.some((salt) => !salt)) report('missing-salt');
    if (diagnostics.length !== start) return;
    records.push({
      serviceName,
      serviceInfo: info.replaceAll('\\C', ',').replaceAll('\\n', '\n'),
      hasCapital: capital.toLowerCase() === 'true',
      hasNumeral: numeral.toLowerCase() === 'true',
      symbols: symbols.replaceAll('\\S', ' ').replaceAll('\\C', ','),
      passwordLength: Number(length),
      salts: [...salts].reverse(),
    });
  });
  return diagnostics.length
    ? { ok: false, diagnostics }
    : { ok: true, records };
}
