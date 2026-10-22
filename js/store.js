// A tiny "room store" interface shared by solo play (LocalStore) and online play (FirebaseStore).
//   subscribe(fn) -> unsubscribe     fn(roomState | null)
//   update({ 'a/b': value, ... })    multi-path write, null deletes
//   transaction(path, fn)            -> { committed, value }; fn returns undefined to abort
//   now()                            server-ish time in ms

export function getAt(obj, path) {
  return path.split('/').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setAt(obj, path, value) {
  const keys = path.split('/');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (o[keys[i]] == null || typeof o[keys[i]] !== 'object') o[keys[i]] = {};
    o = o[keys[i]];
  }
  const last = keys[keys.length - 1];
  if (value === null || value === undefined) delete o[last];
  else o[last] = clone(value);
}

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

// Turns Firebase's array-or-object lists into a plain ordered array.
export function toList(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x.filter((v) => v != null);
  return Object.keys(x).sort((a, b) => Number(a) - Number(b)).map((k) => x[k]);
}

export class LocalStore {
  constructor(initial = null) {
    this.state = clone(initial);
    this.listeners = new Set();
    this.pending = false;
  }
  now() { return Date.now(); }
  snapshot() { return clone(this.state); }
  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }
  emit() {
    if (this.pending) return;
    this.pending = true;
    queueMicrotask(() => {
      this.pending = false;
      const s = this.snapshot();
      this.listeners.forEach((fn) => fn(s));
    });
  }
  async update(updates) {
    if (!this.state) this.state = {};
    for (const [p, v] of Object.entries(updates)) setAt(this.state, p, v);
    this.emit();
  }
  async transaction(path, fn) {
    const cur = clone(getAt(this.state, path));
    const next = fn(cur === undefined ? null : cur);
    if (next === undefined) return { committed: false, value: cur };
    await this.update({ [path]: next });
    return { committed: true, value: next };
  }
  async exists() { return !!this.state; }
  async create(room) { this.state = clone(room); this.emit(); }
  presence() {}
  leave() { this.listeners.clear(); }
}
