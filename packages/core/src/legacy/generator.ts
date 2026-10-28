/** SHA-512 of UTF-8 text, returned as exactly 128 hexadecimal characters. */
export type Sha512 = (text: string) => string | Promise<string>;

export interface LegacyConditions {
  hasCapital: boolean;
  hasNumeral: boolean;
  symbols: string;
  passwordLength: number;
}

export class LegacyGenerationError extends Error {
  constructor(
    public readonly code: 'invalid-input' | 'invalid-digest' | 'exhausted',
  ) {
    super(code);
    this.name = 'LegacyGenerationError';
  }
}

/** java.util.Random, used by Scala 2.12 Random.shuffle. State is per request. */
export class LegacyRandom {
  private seed: bigint;
  private static readonly multiplier = 0x5deece66dn;
  private static readonly mask = (1n << 48n) - 1n;

  constructor(seed: number) {
    this.seed = (BigInt(seed) ^ LegacyRandom.multiplier) & LegacyRandom.mask;
  }

  private next(bits: number): number {
    this.seed = (this.seed * LegacyRandom.multiplier + 11n) & LegacyRandom.mask;
    return Number(this.seed >> BigInt(48 - bits));
  }

  nextInt(bound?: number): number {
    if (bound === undefined) return this.next(32) | 0;
    if (!Number.isInteger(bound) || bound <= 0 || bound > 0x7fffffff) {
      throw new LegacyGenerationError('invalid-input');
    }
    if ((bound & -bound) === bound)
      return Math.floor((bound * this.next(31)) / 2 ** 31);
    let bits: number;
    let value: number;
    do {
      bits = this.next(31);
      value = bits % bound;
      // Java evaluates this rejection condition with signed 32-bit overflow.
    } while (((bits - value + (bound - 1)) | 0) < 0);
    return value;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const result = [...items];
    for (let n = result.length; n >= 2; n--) {
      const k = this.nextInt(n);
      [result[n - 1], result[k]] = [result[k], result[n - 1]];
    }
    return result;
  }
}

export async function legacyHash(
  master: string,
  salt: string,
  sha512: Sha512,
): Promise<string> {
  const hash = async (text: string): Promise<string> => {
    const hex = await sha512(text);
    if (!/^[\da-f]{128}$/i.test(hex))
      throw new LegacyGenerationError('invalid-digest');
    return hex
      .split('')
      .map((c) => parseInt(c, 16).toString(2).padStart(4, '0'))
      .join('');
  };
  let value = master;
  for (let i = 0; i < 32; i++)
    value = await hash(salt + (await hash(value + salt)));
  return value;
}

/** PC-compatible generation; UI master restrictions are deliberately separate. */
export async function generateLegacyPc(
  master: string,
  salt: string,
  conditions: LegacyConditions,
  sha512: Sha512,
): Promise<string> {
  const { hasCapital, hasNumeral, symbols, passwordLength } = conditions;
  if (
    typeof master !== 'string' ||
    typeof salt !== 'string' ||
    typeof hasCapital !== 'boolean' ||
    typeof hasNumeral !== 'boolean' ||
    typeof symbols !== 'string' ||
    !Number.isInteger(passwordLength) ||
    passwordLength < 1 ||
    passwordLength > 64
  ) {
    throw new LegacyGenerationError('invalid-input');
  }
  const bits = await legacyHash(master, salt, sha512);
  const seed = parseInt(bits.slice(456, 484), 2) + parseInt(bits.slice(484), 2);
  const letters = (
    'abcdefghijklmnopqrstuvwxyz' +
    (hasCapital ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : '') +
    (hasNumeral ? '0123456789' : '') +
    symbols
  ).split(''); // Scala Char and legacy JS both iterate UTF-16 code units.
  const width = Math.floor(512 / passwordLength);
  const indexes = Array.from({ length: passwordLength }, (_, i) =>
    Number(
      BigInt('0b' + bits.slice(width * i, width * i + width - 1)) %
        BigInt(letters.length),
    ),
  );
  for (let additionalSeed = 0; additionalSeed <= 100; additionalSeed++) {
    const shuffled = new LegacyRandom(seed + additionalSeed).shuffle(letters);
    const password = indexes.map((index) => shuffled[index]).join('');
    if (
      !/[\r\n\u0085\u2028\u2029]/.test(password) &&
      /[a-z]/.test(password) &&
      (!hasCapital || /[A-Z]/.test(password)) &&
      (!hasNumeral || /[0-9]/.test(password)) &&
      (!symbols || password.split('').some((c) => symbols.includes(c)))
    ) {
      return password;
    }
  }
  throw new LegacyGenerationError('exhausted');
}
