import { StartTagToken } from 'parse5-sax-parser';
import { Component } from './component';
import { Directive } from './directive';
import { Parser } from './parser';

export class Template implements Parser {
  constructor(model: string, components: Component[], directives: Directive[]) {
    this.model = model;
    this.context = new Context(components, directives);
    this.scopes = [new Scope(this.context, false)];
  }

  start(t: StartTagToken): void {
    const next = this.currentScope().start(t);

    if (next) {
      this.scopes.push(next);
    }
  }

  end(): boolean {
    const scope = this.currentScope();
    const end = scope.end();

    // check if ended scope is not the root scope
    if (end && this.scopes.length > 1) {
      this.scopes.pop();

      if (scope.implicit) {
        // when implicit scope ended (scope that does not begin with <template>) we will always at the end tag of the parent scope
        // so this should always return false
        this.currentScope().end();
      }

      return false;
    } else {
      return end;
    }
  }

  text(t: string): void {
    this.currentScope().text(t);
  }

  toTypeScript(): string {
    let r = `import Model from './${this.model}';\n`;

    // dependencies
    r += `import { Component } from '@dovm/core';\n`;

    for (const c of this.context.components.values()) {
      r += `import ${c.name} from '${c.src}';\n`;
    }

    for (const d of this.context.directives.values()) {
      r += `import { ${d.name} } from '${d.src}';\n`;
    }

    // slot components
    for (const slot of this.context.slots) {
      r += `\nclass ${slot.component} extends Component {\n`;
      r += `  async render(): Promise<void> {\n`;
      for (const { line, indent } of slot.scope.lines) {
        r += `  ${'  '.repeat(indent)}${line}\n`;
      }
      r += `  }\n`;
      r += '}\n';
    }

    // render function
    r += '\nexport async function render(this: Model): Promise<void> {\n';
    for (const { line, indent } of this.currentScope().lines) {
      r += `${'  '.repeat(indent)}${line}\n`;
    }
    r += '}\n';

    return r;
  }

  private currentScope(): Scope {
    return this.scopes[this.scopes.length - 1];
  }

  private readonly model: string;
  private readonly context: Context;
  private readonly scopes: Scope[];
}

class Scope {
  readonly context: Context;
  readonly implicit: boolean;
  readonly lines: Array<{ line: string, indent: number }>;

  constructor(context: Context, implicit: boolean) {
    this.context = context;
    this.implicit = implicit;
    this.lines = [];
    this.stack = [new ElementNode('this.container')];
  }

  start(tag: StartTagToken): Scope | undefined {
    // push current text node before pushing a new tag
    let parent = this.current();

    if (parent instanceof TextNode) {
      this.stack.pop();
      this.writeTextNode(parent.value);
      parent = this.current();
    }

    // get scope
    let scope: Scope;

    if (parent instanceof ElementNode) {
      scope = this;
    } else if (!(parent instanceof ComponentNode)) {
      throw new Error(`Unexpected parent for <${tag.tagName}>.`);
    } else if (tag.tagName === 'template') {
      const index = tag.attrs.findIndex(a => a.name[0] === '#');

      if (index === -1) {
        throw new Error('No slot name is specified.');
      }

      const name = tag.attrs[index].name.substring(1);

      if (name in parent.slots) {
        throw new Error(`Duplicated '${name}' slot for component '${tag.tagName}'.`);
      }

      return parent.slots[name] = new Scope(this.context, false);
    } else if ('main' in parent.slots) {
      throw new Error(`Duplicated 'main' slot for component '${tag.tagName}'.`);
    } else {
      scope = parent.slots.main = new Scope(this.context, true);
    }

    // check if tag name matched with registered components
    const name = this.context.genVarName();
    const component = this.context.components.get(toPascalCase(tag.tagName));

    if (component) {
      if (tag.selfClosing) {
        // the parent is always ElementNode
        scope.write(`const ${name} = this.createComponent(${component.name}, { services: this.services, container: ${(scope.current() as ElementNode).name}, attrs: {}, slots: {} });`);
        scope.write(`await ${name}.render();`);
        return undefined;
      }

      scope.stack.push(new ComponentNode(name, tag.tagName, component.name));
    } else {
      // tag is html element
      scope.write(`const ${name} = document.createElement('${tag.tagName}');`);

      // process attributes
      const directives = new Array<{ directive: Directive, value: string }>();

      for (const attr of tag.attrs) {
        if (attr.name === 'class') {
          scope.write(`${name}.classList.add(${attr.value.split(/\s+/).map(c => `'${c}'`).join(', ')});`);
        } else if (attr.name[0] === '!') {
          const directive = this.context.directives.get(toCamelCase(attr.name.substring(1)));

          if (!directive) {
            throw new Error(`Unknow directive '${attr.name.substring(1)}'.`);
          }

          directives.push({ directive, value: attr.value });
        } else {
          scope.write(`${name}.setAttribute('${attr.name}', ${parseAttr(attr.value)});`);
        }
      }

      // generate directives
      for (const d of directives) {
        scope.write(`${d.directive.name}(${name}, ${parseProp(d.value)});`);
      }

      // append to parent
      // parent is always ElementNode
      if ((scope.current() as ElementNode).name === 'this.container') {
        scope.write(`this.children.push(${name});`);
      }

      if (tag.selfClosing || VoidElements.has(tag.tagName)) {
        scope.write(`${(scope.current() as ElementNode).name}.appendChild(${name});`);
        return undefined;
      }

      scope.stack.push(new ElementNode(name));
    }

    // check if new scope has been started
    if (scope === this) {
      return undefined;
    } else {
      return scope;
    }
  }

  end(): boolean {
    // check if we are in the text node
    let current = this.stack.pop();

    if (current instanceof TextNode) {
      this.writeTextNode(current.value.trimEnd());
      current = this.stack.pop();
    }

    // do nothing if this is the end of scope
    if (!this.stack.length) {
      return true;
    }

    // process tag end
    const parent = this.current();

    if (!(parent instanceof ElementNode)) {
      // this should never happen due to nested tags inside a component always end up inside another scope, thus the parent is always this.container
      throw new Error('Unexpected parent.');
    }

    if (current instanceof ComponentNode) {
      const slots = new Array<string>();

      for (const name in current.slots) {
        const scope = current.slots[name];
        const component = this.context.genSlotComponent();

        this.context.slots.push({ component, scope });
        slots.push(`${name}: (c) => new ${component}({ services: c.services, container: c.container, attrs: {}, slots: {} })`);
      }

      this.write(`const ${current.name} = this.createComponent(${current.component}, { services: this.services, container: ${parent.name}, attrs: {}, slots: { ${slots.join(', ')} } });`);
      this.write(`await ${current.name}.render();`);
    } else {
      this.write(`${parent.name}.appendChild(${(current as ElementNode).name});`);
    }

    return false;
  }

  text(v: string): void {
    v = v.trimStart();

    if (v) {
      this.stack.push(new TextNode(v));
    }
  }

  private writeTextNode(value: string): void {
    const parent = this.current();

    // get scope
    let scope: Scope;

    if (parent instanceof ElementNode) {
      scope = this;
    } else if (!(parent instanceof ComponentNode)) {
      // this should never happen
      throw new Error(`Unexpected parent for '${value}'.`);
    } else if ('main' in parent.slots) {
      throw new Error(`Duplicated slot 'main' for component '${parent.tag}'.`);
    } else {
      scope = parent.slots.main = new Scope(this.context, true);
    }

    // create text node
    const name = this.context.genVarName();
    const dollar = value.indexOf('$');
    const ip = dollar >= 0 ? extractInterporation(value, dollar) : undefined;

    if (ip) {
      const expr = `'${escape(ip.before)}' + v${ip.nav}.toString() + '${escape(ip.after)}'`;

      scope.write(`const ${name} = document.createTextNode('');`);
      scope.write(`await this.watch(this.${ip.name}, v => ${name}.data = ${expr});`);
    } else {
      scope.write(`const ${name} = document.createTextNode('${escape(value)}');`);
    }

    // append to parent
    // the parent will be always ElementNode here
    scope.write(`${(scope.current() as ElementNode).name}.appendChild(${name});`);

    if ((scope.current() as ElementNode).name === 'this.container') {
      scope.write(`this.children.push(${name});`);
    }
  }

  private write(line: string, indent = 1): void {
    this.lines.push({ line, indent });
  }

  private current(): TemplateNode {
    return this.stack[this.stack.length - 1];
  }

  private readonly stack: Array<TemplateNode>;
}

class TemplateNode {
}

class TextNode extends TemplateNode {
  constructor(readonly value: string) {
    super();
  }
}

class ElementNode extends TemplateNode {
  constructor(readonly name: string) {
    super();
  }
}

class ComponentNode extends TemplateNode {
  readonly name: string;
  readonly tag: string;
  readonly component: string;
  readonly slots: { [name: string]: Scope };

  constructor(name: string, tag: string, component: string) {
    super();
    this.name = name;
    this.tag = tag;
    this.component = component;
    this.slots = {};
  }
}

class Context {
  readonly components: Map<string, Component>;
  readonly directives: Map<string, Directive>;
  readonly slots: Array<{ component: string, scope: Scope }>;

  constructor(components: Component[], directives: Directive[]) {
    this.components = new Map(components.map(c => [c.name, c]));
    this.directives = new Map(directives.map(d => [d.name, d]));
    this.slots = [];
    this.nameId = 0;
  }

  genVarName(): string {
    return `v${this.nameId++}`;
  }

  genSlotComponent(): string {
    return `SlotComponent${this.nameId++}`;
  }

  private nameId: number;
}

function extractInterporation(t: string, s: number): { name: string, nav: string, before: string, after: string } | undefined {
  if (s === t.length - 1) {
    throw new Error('No member name is specified after $.');
  } else if (t.charAt(s + 1) === '$') {
    return undefined;
  }

  const e = t.indexOf(' ', s + 1);
  let i: string, a: string;

  if (e === -1) {
    i = t.substring(s + 1);
    a = '';
  } else if (e === s + 1) {
    throw new Error('No member name is specified after $.');
  } else {
    i = t.substring(s + 1, e);
    a = t.substring(e);
  }

  const b = t.substring(0, s);
  const d = i.indexOf('.');

  if (d === -1) {
    return { name: i, nav: '', before: b, after: a };
  } else {
    return { name: i.substring(0, d), nav: i.substring(d), before: b, after: a };
  }
}

function parseAttr(v: string): string {
  if (v.length > 2 && v[0] === '{' && v.slice(-1) === '}') {
    return v.substring(1, v.length - 1).trim();
  } else {
    return JSON.stringify(v);
  }
}

function parseProp(v: string): string {
  const n = parseFloat(v);

  if (n === NaN) {
    return parseAttr(v);
  } else {
    return n.toString();
  }
}

function toPascalCase(t: string): string {
  return t.replace(/(^\w|-\w)/g, t => t.replace(/-/, '').toUpperCase());
}

function toCamelCase(t: string): string {
  return t.replace(/-\w/g, t => t.replace(/-/, '').toUpperCase());
}

function escape(t: string): string {
  return t.replace(/\n/g, '\\n');
}

const VoidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
