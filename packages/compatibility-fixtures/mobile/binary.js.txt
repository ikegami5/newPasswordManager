export class Binary {
  constructor(str) {
    this.value = str.replace(/^0*/, '');
    if (!this.value) {
      this.value = '0';
    }
  }

  left_shift(num) {
    const result = this.value + '0'.repeat(num);
    return new Binary(result);
  }

  right_shift(num) {
    const result = this.value.substring(0, this.value.length - num);
    return new Binary(result);
  }

  sum(binary) {
    const diff = this.value.length - binary.value.length;
    const this_str = diff >= 0 ? this.value : '0'.repeat(-diff) + this.value;
    const that_str = diff > 0 ? '0'.repeat(diff) + binary.value : binary.value;
    const this_arr = Array.prototype.map
      .call(this_str, (bit) => parseInt(bit, 10))
      .reverse();
    const that_arr = Array.prototype.map
      .call(that_str, (bit) => parseInt(bit, 10))
      .reverse();
    let result = '';
    let carry = 0;
    for (let i = 0; i < this_arr.length; i++) {
      const bit = (carry + this_arr[i] + that_arr[i]) % 2;
      carry = carry + this_arr[i] + that_arr[i] > 1 ? 1 : 0;
      result = bit + result;
    }
    result = carry + result;
    return new Binary(result);
  }

  not() {
    return new Binary(
      Array.prototype.map
        .call(this.value, (bit) => (bit === '1' ? '0' : '1'))
        .join(''),
    );
  }

  subtract(binary) {
    const diff = this.value.length - binary.value.length;
    const binary_not_value = binary.not().value;
    const not_str =
      '1'.repeat(diff) +
      '0'.repeat(binary.value.length - binary_not_value.length) +
      binary_not_value;
    const sum_binary = this.sum(new Binary(not_str));
    return new Binary(
      new Binary('1').sum(new Binary(sum_binary.value.substring(1))).value,
    );
  }

  and(binary) {
    const diff = this.value.length - binary.value.length;
    const this_str = diff >= 0 ? this.value : '0'.repeat(-diff) + this.value;
    const that_str = diff > 0 ? '0'.repeat(diff) + binary.value : binary.value;
    const this_arr = Array.prototype.map
      .call(this_str, (bit) => parseInt(bit, 10))
      .reverse();
    const that_arr = Array.prototype.map
      .call(that_str, (bit) => parseInt(bit, 10))
      .reverse();
    let result = '';
    for (let i = 0; i < this_arr.length; i++) {
      const bit = this_arr[i] + that_arr[i] === 2 ? 1 : 0;
      result = bit + result;
    }
    return new Binary(result);
  }

  xor(binary) {
    const diff = this.value.length - binary.value.length;
    const this_str = diff >= 0 ? this.value : '0'.repeat(-diff) + this.value;
    const that_str = diff > 0 ? '0'.repeat(diff) + binary.value : binary.value;
    const this_arr = Array.prototype.map
      .call(this_str, (bit) => parseInt(bit, 10))
      .reverse();
    const that_arr = Array.prototype.map
      .call(that_str, (bit) => parseInt(bit, 10))
      .reverse();
    let result = '';
    for (let i = 0; i < this_arr.length; i++) {
      const bit = this_arr[i] + that_arr[i] === 1 ? 1 : 0;
      result = bit + result;
    }
    return new Binary(result);
  }

  multiply(binary) {
    const that_arr = Array.prototype.map
      .call(binary.value, (bit) => parseInt(bit, 10))
      .reverse();
    return that_arr.reduce((acc, current, index) => {
      if (current) {
        return acc.sum(this.left_shift(index));
      } else {
        return acc;
      }
    }, new Binary('0'));
  }

  // binary must be small and both must be positive
  mod(binary) {
    if (this.value.length < 30) {
      return parseInt(this.value, 2) % parseInt(binary.value, 2);
    }
    const diff = this.value.length - binary.value.length;
    const multiple_binary = binary.left_shift(diff - 1);
    const remain_binary = this.subtract(multiple_binary);
    return parseInt(remain_binary.value, 2) % parseInt(binary.value, 2);
  }
}
