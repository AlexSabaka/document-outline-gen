import { readFile } from 'fs';

export class Calculator {
  static version = '1.0';

  constructor(value) {
    this.value = value;
  }

  add(x) {
    return this.value + x;
  }

  static create() {
    return new Calculator(0);
  }
}

export function helper(a, b = 1) {
  return a + b;
}

export const greet = (name) => `hi, ${name}`;

exports.legacy = function () {
  return null;
};
