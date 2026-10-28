import * as RNFS from 'react-native-fs';
import sha512 from 'crypto-js/sha512';
import {Random} from './random.js';
import {Binary} from './binary.js';

async function read_file() {
  return await RNFS.readDir(RNFS.ExternalDirectoryPath)
    .then((files) => {
      return files.find((f) => f.name === 'data.txt');
    })
    .then((file) => {
      return RNFS.readFile(file.path);
    })
    .then((content) => {
      return parse_records(content);
    })
    .catch((err) => {
      console.log(err.message);
    });
}

function parse_records(data) {
  return data.split(/\r?\n/).map((d) => {
    return new Record(d.split(',').map((s) => s.trim()));
  });
}

class Record {
  constructor(data) {
    this.service_name = data[0].replace(/\\C/g, ',');
    this.service_info = data[1].replace(/\\C/g, ',').replace(/\\n/g, '\n');
    this.has_capital = data[2] === 'true';
    this.has_numeral = data[3] === 'true';
    this.symbols = data[4].replace(/\\S/g, ' ').replace(/\\C/g, ',');
    this.password_length = parseInt(data[5], 10);
    this.salts = data.slice(6).reverse();
  }
}

function get_password(
  salt,
  master_password,
  password_length,
  has_capital,
  has_numeral,
  symbols,
) {
  const hashed_string = hash_64_times(master_password, salt);
  return format_password(
    hashed_string,
    password_length,
    has_capital,
    has_numeral,
    symbols,
  );
}

export function format_password(
  str,
  password_length,
  has_capital,
  has_numeral,
  symbols,
) {
  const initial_seed =
    parseInt(str.substring(456, 484), 2) + parseInt(str.substring(484), 2);
  const alphabets = 'abcdefghijklmnopqrstuvwxyz';
  const capital_alphabets = has_capital ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : '';
  const numerals = has_numeral ? '0123456789' : '';
  const letters = alphabets + capital_alphabets + numerals + symbols;
  const letters_list = Array.prototype.map.call(letters, (l) => l);
  for (let additional_seed = 0; additional_seed <= 100; additional_seed++) {
    const random = new Random(initial_seed + additional_seed);
    const tmp_letters_list = random.shuffle(letters_list);
    const tmp_password = [...Array(password_length).keys()]
      .map((index) => {
        const word_length = Math.floor(str.length / password_length);
        const word_string = str.substring(
          word_length * index,
          word_length * index + word_length - 1,
        );
        const letter_index = new Binary(word_string).mod(
          new Binary(tmp_letters_list.length.toString(2)),
        );
        return tmp_letters_list[letter_index];
      })
      .join('');
    const is_proper_password =
      /^.*[a-z].*$/.test(tmp_password) &&
      (has_capital ? /^.*[A-Z].*$/.test(tmp_password) : true) &&
      (has_numeral ? /^.*[0-9].*$/.test(tmp_password) : true) &&
      (symbols
        ? new RegExp(
            '^.*[' + symbols.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '].*$',
          ).test(tmp_password)
        : true);
    if (is_proper_password) {
      return tmp_password;
    }
  }
  console.log('パスワードが生成できなかったよ');
  return '';
}

export function hash(str) {
  const hex = sha512(str).toString();
  const binary = Array.prototype.map
    .call(hex, (c) => {
      return hexToBinary(c);
    })
    .join('');
  return binary;
}

function hexToBinary(hex) {
  return ('0000' + parseInt(hex, 16).toString(2)).slice(-4);
}

function hash_twice(str, salt) {
  return hash(salt + hash(str + salt));
}

function compose(func) {
  return (str, salt) => {
    return func(func(str, salt), salt);
  };
}

function hash_8_times(str, salt) {
  return compose(compose(hash_twice))(str, salt);
}

function hash_32_times(str, salt) {
  return compose(compose(hash_8_times))(str, salt);
}

function hash_64_times(str, salt) {
  return compose(hash_32_times)(str, salt);
}

export {read_file, get_password};
