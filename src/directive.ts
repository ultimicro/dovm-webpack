import { Attribute } from 'parse5';
import { Parser } from './parser';

export class Directive implements Parser {
  readonly name: string;
  readonly src: string;

  constructor(attrs: Attribute[]) {
    let name, src;

    for (const a of attrs) {
      switch (a.name) {
        case 'name':
          name = a.value;
          break;
        case 'src':
          src = a.value;
          break;
        default:
          throw new Error(`Invalid attribute '${a.name}' on <directive>`);
      }
    }

    if (!name) {
      throw new Error("No 'name' has been specified on <directive>");
    }

    if (!src) {
      throw new Error("No 'src' has been specified on <directive>");
    }

    this.name = name;
    this.src = src;
  }

  start() {
    throw new Error('Not implemented');
  }

  end() {
    return true;
  }

  text(v: string) {
    if (v.trim()) {
      throw new Error('Text does not allowed inside <directive>');
    }
  }
};
