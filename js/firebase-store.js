// Online room store backed by Firebase Realtime Database.
import { firebaseConfig } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
let fb = null;

export const onlineReady = () =>
  !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.databaseURL);

async function sdk() {
  if (fb) return fb;
  const [{ initializeApp }, db] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-database.js`),
  ]);
  const app = initializeApp(firebaseConfig);
  const database = db.getDatabase(app);
  let offset = 0;
  db.onValue(db.ref(database, '.info/serverTimeOffset'), (s) => { offset = s.val() || 0; });
  fb = { ...db, database, offset: () => offset };
  return fb;
}

export async function openFirebaseStore(code) {
  const f = await sdk();
  return new FirebaseStore(f, code);
}

class FirebaseStore {
  constructor(f, code) {
    this.f = f;
    this.code = code;
    this.root = f.ref(f.database, `rooms/${code}`);
    this.unsubs = [];
  }
  now() { return Date.now() + this.f.offset(); }
  path(p) { return this.f.ref(this.f.database, `rooms/${this.code}/${p}`); }
  subscribe(fn) {
    const off = this.f.onValue(this.root, (s) => fn(s.val()));
    this.unsubs.push(off);
    return off;
  }
  update(updates) { return this.f.update(this.root, updates); }
  async transaction(path, fn) {
    const res = await this.f.runTransaction(this.path(path), (cur) => fn(cur));
    return { committed: res.committed, value: res.snapshot.val() };
  }
  async exists() { return (await this.f.get(this.root)).exists(); }
  async read() { return (await this.f.get(this.root)).val(); }
  async create(room) { await this.f.set(this.root, room); }
  // Marks the player online while connected and offline when the tab closes.
  presence(pid) {
    const online = this.path(`players/${pid}/online`);
    const off = this.f.onValue(this.f.ref(this.f.database, '.info/connected'), (s) => {
      if (s.val() !== true) return;
      this.f.onDisconnect(online).set(false).then(() => this.f.set(online, true));
    });
    this.unsubs.push(off);
  }
  leave(pid) {
    if (pid) this.f.set(this.path(`players/${pid}/online`), false).catch(() => {});
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
  }
}
