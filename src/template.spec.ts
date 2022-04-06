import { assert } from 'chai';
import { Component } from './component';
import { Template } from './template';

describe('toTypeScript', function () {
  it('abc', function () {
    // arrange
    const t = new Template('app', [], []);

    // act
    t.text('abc');

    // assert
    const e = t.end();
    const r = t.toTypeScript();

    assert.isTrue(e);
    assert.strictEqual(r, `import Model from './app';
import { Component } from '@dovm/core';

export async function render(this: Model): Promise<void> {
  const v0 = document.createTextNode('abc');
  this.container.appendChild(v0);
  this.children.push(v0);
}
`);
  });

  it('<foo-component>abc</foo-component>', function () {
    // arrange
    const t = new Template('app', [new Component('FooComponent', './foo-component')], []);

    // act
    t.start({ tagName: 'foo-component', selfClosing: false, attrs: [] });
    t.text('abc');
    assert.isFalse(t.end());

    // assert
    const e = t.end();
    const r = t.toTypeScript();

    assert.isTrue(e);
    assert.strictEqual(r, `import Model from './app';
import { Component } from '@dovm/core';
import FooComponent from './foo-component';

class SlotComponent2 extends Component {
  async render(): Promise<void> {
    const v1 = document.createTextNode('abc');
    this.container.appendChild(v1);
    this.children.push(v1);
  }
}

export async function render(this: Model): Promise<void> {
  const v0 = this.createComponent(FooComponent, { services: this.services, container: this.container, attrs: {}, slots: { main: (c) => new SlotComponent2({ services: c.services, container: c.container, attrs: {}, slots: {} }) } });
  await v0.render();
}
`);
  });

  it(`<p class="class1 class2" dir="{ 'ltr' }">Copyright (c) $now.getFullYear() Ultima Microsystems</p>`, function () {
    // arrange
    const t = new Template('app', [], []);

    // act
    t.start({ tagName: 'p', selfClosing: false, attrs: [{ name: 'class', value: 'class1 class2' }, { name: 'dir', value: "{ 'ltr' }" }] });
    t.text('Copyright (c) $now.getFullYear() Ultima Microsystems');
    assert.isFalse(t.end());

    // assert
    const e = t.end();
    const r = t.toTypeScript();

    assert.isTrue(e);
    assert.strictEqual(r, `import Model from './app';
import { Component } from '@dovm/core';

export async function render(this: Model): Promise<void> {
  const v0 = document.createElement('p');
  v0.classList.add('class1', 'class2');
  v0.setAttribute('dir', 'ltr');
  this.children.push(v0);
  const v1 = document.createTextNode('');
  await this.watch(this.now, v => v1.data = 'Copyright (c) ' + v.getFullYear().toString() + ' Ultima Microsystems');
  v0.appendChild(v1);
  this.container.appendChild(v0);
}
`);
  });

  it(`<foo-bar><img src="/foo.jpg"></foo-bar>`, function () {
    // arrange
    const t = new Template('app', [new Component('FooBar', './foo-bar')], []);

    // act
    t.start({ tagName: 'foo-bar', selfClosing: false, attrs: [] });
    t.start({ tagName: 'img', selfClosing: false, attrs: [{ name: 'src', value: '/foo.jpg' }] });
    assert.isFalse(t.end());

    // assert
    const e = t.end();
    const r = t.toTypeScript();

    assert.isTrue(e);
    assert.strictEqual(r, `import Model from './app';
import { Component } from '@dovm/core';
import FooBar from './foo-bar';

class SlotComponent2 extends Component {
  async render(): Promise<void> {
    const v1 = document.createElement('img');
    v1.setAttribute('src', "/foo.jpg");
    this.children.push(v1);
    this.container.appendChild(v1);
  }
}

export async function render(this: Model): Promise<void> {
  const v0 = this.createComponent(FooBar, { services: this.services, container: this.container, attrs: {}, slots: { main: (c) => new SlotComponent2({ services: c.services, container: c.container, attrs: {}, slots: {} }) } });
  await v0.render();
}
`);
  });

  it('<foo-bar><template #main>bar</template><template #foo><input type="text"></template></foo-bar>', function () {
    // arrange
    const t = new Template('app', [new Component('FooBar', './foo-bar')], []);

    // act
    t.start({ tagName: 'foo-bar', selfClosing: false, attrs: [] });
    t.start({ tagName: 'template', selfClosing: false, attrs: [{ name: '#main', value: '' }] });
    t.text('bar');
    assert.isFalse(t.end());
    t.start({ tagName: 'template', selfClosing: false, attrs: [{ name: '#foo', value: '' }] });
    t.start({ tagName: 'input', selfClosing: false, attrs: [{ name: 'type', value: 'text' }] });
    assert.isFalse(t.end());
    assert.isFalse(t.end());

    // assert
    const e = t.end();
    const r = t.toTypeScript();

    assert.isTrue(e);
    assert.strictEqual(r, `import Model from './app';
import { Component } from '@dovm/core';
import FooBar from './foo-bar';

class SlotComponent3 extends Component {
  async render(): Promise<void> {
    const v1 = document.createTextNode('bar');
    this.container.appendChild(v1);
    this.children.push(v1);
  }
}

class SlotComponent4 extends Component {
  async render(): Promise<void> {
    const v2 = document.createElement('input');
    v2.setAttribute('type', "text");
    this.children.push(v2);
    this.container.appendChild(v2);
  }
}

export async function render(this: Model): Promise<void> {
  const v0 = this.createComponent(FooBar, { services: this.services, container: this.container, attrs: {}, slots: { main: (c) => new SlotComponent3({ services: c.services, container: c.container, attrs: {}, slots: {} }), foo: (c) => new SlotComponent4({ services: c.services, container: c.container, attrs: {}, slots: {} }) } });
  await v0.render();
}
`);
  });
});
