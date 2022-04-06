import { StartTagToken } from 'parse5-sax-parser';
import { Parser } from './parser';

export class Component implements Parser {
  constructor(readonly name: string, readonly src: string) {
  }

  static fromTag(t: StartTagToken): Component {
    let name, src;

    for (const a of t.attrs) {
      switch (a.name) {
        case 'class':
          name = a.value;
          break;
        case 'src':
          src = a.value;
          break;
        default:
          throw new Error(`Invalid attribute '${a.name}' on <component>`);
      }
    }

    if (!name) {
      throw new Error("No 'class' has been specified on <component>");
    }

    if (!src) {
      throw new Error("No 'src' has been specified on <component>");
    }

    return new Component(name, src);
  }

  start() {
    throw new Error('Not implemented');
  }

  end() {
    return true;
  }

  text(v: string) {
    if (v.trim()) {
      throw new Error('Text does not allowed inside <component>');
    }
  }
}
