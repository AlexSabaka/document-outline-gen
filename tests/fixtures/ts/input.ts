import { readFile } from 'fs';

export interface User {
  id: number;
  name: string;
}

export type ID = string | number;

export enum Color {
  Red,
  Green,
  Blue,
}

@Component()
export abstract class Base<T> {
  static version = '1.0';
  protected value: T;

  constructor(value: T) {
    this.value = value;
  }

  abstract render(): string;

  private _secret(): void {}
}

export function helper(x: number, y = 2): number {
  return x + y;
}

export const greet = (name: string): string => `hi ${name}`;
