import {Binary} from './binary.js';

export class Random {
  constructor(seed) {
    this.multiplier = new Binary((0x5dee).toString(2) + (0xce66d).toString(2));
    this.mask = new Binary('1').left_shift(48).subtract(new Binary('1'));
    this.seed = new Binary(seed.toString(2))
      .xor(this.multiplier)
      .and(this.mask);
  }

  next(bits) {
    this.seed = this.seed
      .multiply(this.multiplier)
      .sum(new Binary('1011'))
      .and(this.mask);
    return this.seed.right_shift(48 - bits);
  }

  nextInt(bound) {
    if (bound === undefined) {
      // eslint-disable-next-line no-bitwise
      return parseInt(this.next(32).value, 2) >> 0;
    }
    if (bound <= 0) {
      console.log('random error');
      return null;
    }
    // eslint-disable-next-line no-bitwise
    if ((bound & -bound) === bound) {
      const bound_length = new Binary(bound.toString(2)).value.length;
      return parseInt(
        this.next(31).right_shift(31 - bound_length + 1).value,
        2,
      );
    }
    let bits;
    let val;
    do {
      bits = parseInt(this.next(31).value, 2);
      val = bits % bound;
    } while (bits - val + (bound - 1) < 0);
    return val;
  }

  shuffle(arr) {
    const result = arr.map((e) => e);
    function swap(i1, i2) {
      const tmp = result[i1];
      result[i1] = result[i2];
      result[i2] = tmp;
    }
    let k;
    for (let n = arr.length; n >= 2; n--) {
      k = this.nextInt(n);
      swap(n - 1, k);
    }
    return result;
  }
}
