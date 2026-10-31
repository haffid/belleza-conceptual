'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// A small DOM/transport double isolates the browser controller from HTTP,
// real credentials, uploads and inventory. Assertions live in the test file.
async function storeUI({ admin = false, route = () => [] } = {}) {
  const nodes = new Map(), calls = [];
  class Element {
    constructor() {
      this.events = new Map(); this.dataset = {}; this.children = [];
      this.value = ''; this.files = []; this.hidden = true; this.disabled = false;
      this.fields = {}; this.classList = { toggle: (name, value) => { this[name] = value; } };
      this.elements = new Proxy(this.fields, { get: (target, key) => target[key] ||= new Element() });
    }
    addEventListener(name, fn) { this.events.set(name, fn); }
    async fire(name) { return this.events.get(name)?.({ target: this, preventDefault() {} }); }
    querySelector() { return this.button ||= new Element(); }
    reset() { for (const field of Object.values(this.fields)) field.value = ''; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    set innerHTML(value) {
      this.html = value; this.children = [];
      for (const match of value.matchAll(/<button\b([^>]*)>/g)) {
        const button = new Element();
        for (const attr of match[1].matchAll(/data-([a-z]+)="([^"]*)"/g)) button.dataset[attr[1]] = attr[2];
        this.children.push(button);
      }
    }
    get innerHTML() { return this.html || ''; }
  }
  const get = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  class FormDataDouble {
    constructor(form) { this.entries = form ? Object.entries(form.fields).filter(([, v]) => !v.disabled).map(([k, v]) => [k, v.value]) : []; }
    append(key, value) { this.entries.push([key, value]); }
    [Symbol.iterator]() { return this.entries[Symbol.iterator](); }
  }
  get('product-form').fields.imagenes = get('images');
  get('stock-filter').value = 'all';
  const state = { reloads: 0, confirm: true, startup: { status: 401, error: 'Sin sesión' } };
  const context = {
    document: {
      body: { dataset: { page: admin ? 'admin' : 'account' } },
      getElementById: get, createElement: () => new Element(),
      querySelectorAll(selector) {
        const key = selector.match(/data-([a-z]+)/)[1];
        return [...nodes.values()].flatMap(n => n.children).filter(n => Object.hasOwn(n.dataset, key));
      },
    },
    FormData: FormDataDouble, confirm: () => state.confirm,
    location: { reload: () => state.reloads++ },
    fetch: async (url, options) => {
      calls.push({ url, ...options });
      const result = url === '/api/me' && options.method === 'GET' ? state.startup : await route(url, options);
      const status = typeof result?.status === 'number' ? result.status : 200;
      return { ok: status < 400, status, json: async () => result };
    },
  };
  const filename = path.resolve(__dirname, '../../store-ui.js');
  const source = fs.readFileSync(filename, 'utf8').replace(/\}\)\(\);\s*$/, 'globalThis.ui = { api, enter, refresh, renderInventory, editor, previewPhotos, setUser: value => {user=value}, setInventory: value => {inventory=value} }; })();');
  vm.runInNewContext(source, context, { filename });
  await new Promise(resolve => setImmediate(resolve));
  return { ...context.ui, get, calls, state, FormDataDouble,
    fields(id, fields) { for (const [key, value] of Object.entries(fields)) get(id).elements[key].value = value; return get(id); },
    buttons(key) { return context.document.querySelectorAll('[data-' + key + ']'); },
  };
}
module.exports = { storeUI };
