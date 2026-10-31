'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { mock } = require('node:test');

// Doble mínimo del DOM: conserva HTML, atributos y eventos observables.
// Las decisiones de catálogo/carrito siguen ejecutándose en el script real.
class Element {
  constructor(document, attributes = '') {
    this.document = document; this.events = new Map(); this.dataset = {};
    this.style = {}; this.value = ''; this.disabled = false; this.textContent = '';
    this.children = []; this._html = ''; this.classes = new Set();
    for (const match of attributes.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) {
      const [, key, value = ''] = match;
      if (key.startsWith('data-')) this.dataset[key.slice(5)] = value;
      else if (key === 'class') this.classes = new Set(value.split(/\s+/));
      else if (key === 'style') {
        for (const declaration of value.split(';')) {
          const [property, content] = declaration.split(':');
          if (property?.trim()) this.style[property.trim()] = content?.trim();
        }
      }
      else if (['disabled', 'required', 'readonly'].includes(key)) this[key] = true;
      else this[key] = value;
    }
    this.classList = {
      add: name => this.classes.add(name), remove: name => this.classes.delete(name),
      contains: name => this.classes.has(name),
      toggle: (name, value) => value ? this.classes.add(name) : this.classes.delete(name),
    };
  }
  set innerHTML(value) {
    this._html = value; this.children = [];
    for (const [, attrs] of value.matchAll(/<[a-z][a-z0-9-]*\b([^>]*)>/gi)) {
      const element = new Element(this.document, attrs); this.children.push(element);
      if (element.id) this.document.nodes.set(element.id, element);
    }
  }
  get innerHTML() { return this._html; }
  querySelectorAll(selector) {
    if (selector.startsWith('.')) return this.children.filter(e => e.classes.has(selector.slice(1)));
    const attr = selector.slice(1, -1).replace(/^data-/, '');
    return this.children.filter(e => Object.hasOwn(e.dataset, attr));
  }
  addEventListener(event, fn) {
    if (!this.events.has(event)) this.events.set(event, []);
    this.events.get(event).push(fn);
  }
  async fire(event = 'click') {
    for (const fn of this.events.get(event) || []) await fn({ target: this, preventDefault() {} });
  }
}

async function frontend({ products = [], savedCart = '[]', fetch: injectedFetch } = {}) {
  const document = { nodes: new Map(), getElementById(id) {
    if (!this.nodes.has(id)) this.nodes.set(id, new Element(this));
    return this.nodes.get(id);
  } };
  const storage = new Map([['bc_cart', savedCart]]);
  const localStorage = {
    getItem: mock.fn(key => storage.get(key) ?? null),
    setItem: mock.fn((key, value) => storage.set(key, value)),
  };
  const fetch = mock.fn(injectedFetch || (async url => url === '/api/me'
    ? { ok: false, status: 401, json: async () => ({}) }
    : { ok: true, status: 200, json: async () => products }));
  const filename = path.resolve(__dirname, '../../index.html');
  const html = fs.readFileSync(filename, 'utf8');
  const start = html.indexOf('<script>') + '<script>'.length;
  const end = html.indexOf('</script>', start);
  if (start < 8 || end < start) throw new Error('No se encontró el script de la tienda.');
  const source = html.slice(start, end);
  const last = source.lastIndexOf('})();');
  // Solo el arnés expone el estado y las funciones léxicas; el HTML queda intacto.
  const hook = 'globalThis.__storefront = {state, loadProducts, renderGrid, renderFilters, updateCartCount, cartTotal, renderCartStep, renderCheckoutStep, submitOrder, openDrawer, closeDrawer};';
  const exposed = source.slice(0, last) + hook + source.slice(last);
  const padding = html.slice(0, start).replace(/[^\n]/g, ' ');
  const context = vm.createContext({ document, localStorage, fetch, console, URL, setTimeout, clearTimeout });
  new vm.Script(padding + exposed, { filename }).runInContext(context);
  await new Promise(resolve => setImmediate(resolve));
  return { unit: context.__storefront, document, localStorage, storage, fetch };
}
const plain = value => JSON.parse(JSON.stringify(value));
module.exports = { frontend, plain };
