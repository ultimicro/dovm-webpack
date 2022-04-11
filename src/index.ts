
import fs = require('fs');
import SAXParser = require('parse5-sax-parser');
import path = require('path');
import { LoaderDefinition } from 'webpack';
import { Component } from './component';
import { Directive } from './directive';
import { Parser } from './parser';
import { Template } from './template';

interface Options {
  sourceFile?: boolean;
}

const loader: LoaderDefinition<Options> = function (source) {
  const options = this.getOptions();

  // setup parser
  const model = path.parse(this.resourcePath).name;
  const parser = new SAXParser();
  const components = new Array<Component>();
  const directives = new Array<Directive>();
  let current: Parser | undefined;
  let template: Template | undefined;

  parser.on('startTag', t => {
    if (current) {
      current.start(t);
    } else {
      switch (t.tagName) {
        case 'component':
          if (template) {
            throw new Error('<component> must come before <template>');
          }

          components.push(current = Component.fromTag(t));
          break;
        case 'directive':
          if (template) {
            throw new Error('<directive> must come before <template>');
          }

          directives.push(current = new Directive(t.attrs));
          break;
        case 'template':
          if (template) {
            throw new Error('Only one <template> is allowed');
          }

          current = template = new Template(model, components, directives);
          break;
        default:
          throw new Error(`Unknow block <${t.tagName}>`);
      }

      if (t.selfClosing) {
        current = undefined;
      }
    }
  });

  parser.on('endTag', t => {
    if (current) {
      if (current.end()) {
        current = undefined;
      }
    } else {
      throw new Error(`Found end tag of <${t.tagName}> but we did not start this tag yet.`);
    }
  });

  parser.on('text', t => {
    current?.text(t.text);
  });

  // parse
  parser.end(source);

  if (!template) {
    throw new Error('No <template> has been defined');
  }

  // transform
  const result = template.toTypeScript();

  if (options.sourceFile) {
    fs.writeFileSync(this.resourcePath + '.ts', result);
  }

  return result;
};

export = loader;
