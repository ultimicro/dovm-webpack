import { StartTagToken } from 'parse5-sax-parser';

export interface Parser {
  start(t: StartTagToken): void;
  end(): boolean;
  text(v: string): void;
}
