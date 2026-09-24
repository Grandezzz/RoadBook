const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8').replace(/load\(\);render\(\);void connectCloud\(\);\s*$/, '');
const writes = [];
const uploads = [];
const signed = [];
let uploadError = null;
const cloud = {
  from(table) {
    assert.equal(table, 'roadbook_data');
    return {async upsert(row) { writes.push(structuredClone(row)); return {error: null}; }};
  },
  storage: {from(bucket) {
    assert.equal(bucket, 'roadbook-images');
    return {
      async upload(key, file) { uploads.push({key, type: file.type}); return {error: uploadError}; },
      async createSignedUrl(key) { signed.push(key); return {data: {signedUrl: `https://example.test/${key}`}, error: null}; },
      async createSignedUrls(keys) { return {data: keys.map(key => ({path: key, signedUrl: `https://example.test/${key}`})), error: null}; }
    };
  }}
};
const local = new Map([['roadbook-demo-v1', 'old image cache']]);
const context = vm.createContext({
  window: {location: {hash: ''}, ROADBOOK_SUPABASE: {url: 'https://example.test', anonKey: 'test'}, supabase: {createClient: () => cloud}},
  localStorage: {getItem: key => local.get(key) ?? null, setItem: (key, value) => local.set(key, value), removeItem: key => local.delete(key)},
  sessionStorage: {getItem: () => null, setItem() {}, removeItem() {}},
  document: {querySelector: () => ({textContent: '', classList: {add() {}, remove() {}}})},
  crypto: {randomUUID: () => 'image-id'},
  URL, URLSearchParams, Blob, File: globalThis.File || class File extends Blob {},
  fetch, structuredClone, Map, Date, setTimeout, clearTimeout,
});
vm.runInContext(source, context);
vm.runInContext('cloudUser = {id:"user-1"}; render = () => {}; showToast = () => {}', context);

(async () => {
  const image = new Blob(['image bytes'], {type: 'image/png'});
  const imagePath = await vm.runInContext('uploadImage', context)(image);
  assert.equal(imagePath, 'user-1/image-id.png');
  assert.equal(uploads.length, 1);
  assert.equal(local.get('roadbook-demo-v1'), 'old image cache');

  const legacy = 'data:image/png;base64,aGVsbG8=';
  vm.runInContext('state = {roadbooks:[{days:{"2026-09-24":[{id:"a",images:["' + legacy + '"]}]}}]}', context);
  await vm.runInContext('migrateEmbeddedImages', context)();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].payload.roadbooks[0].days['2026-09-24'][0].images[0], 'user-1/image-id.png');
  assert.equal(local.get('roadbook-demo-v1'), 'old image cache', 'migration alone must not discard an unverified old copy');
  assert.equal(await vm.runInContext('signedImageUrl', context)(imagePath), `https://example.test/${imagePath}`);
  await vm.runInContext('signedImageUrl', context)(imagePath);
  assert.equal(signed.length, 1);

  vm.runInContext('state = {roadbooks:[{days:{"2026-09-24":[{id:"b",images:["' + legacy + '"]}]}}]}', context);
  uploadError = new Error('bucket missing');
  await assert.rejects(vm.runInContext('migrateEmbeddedImages', context)(), /bucket missing/);
  assert.equal(writes.length, 1, 'a failed upload must not replace cloud data');
  assert.equal(vm.runInContext('state.roadbooks[0].days["2026-09-24"][0].images[0]', context), legacy);
  uploadError = null;
  context.fetch = async () => ({ok: true, blob: async () => new Blob(['large original'], {type: 'image/jpeg'})});
  vm.runInContext('resizeImage = async () => new Blob(["small"], {type:"image/webp"}); save = () => {}', context);
  vm.runInContext('state = {roadbooks:[{days:{"2026-09-24":[{id:"c",images:["user-1/old.jpg"]},{id:"d",images:["user-1/old.jpg"]}]}}]}', context);
  await vm.runInContext('createCloudPreview', context)('user-1/old.jpg');
  assert.equal(vm.runInContext('state.roadbooks[0].days["2026-09-24"][1].imagePreviews["user-1/old.jpg"]', context), 'user-1/old.preview.webp');
  assert.equal(uploads.at(-1).key, 'user-1/old.preview.webp');
  console.log('cloud image upload, migration, preview generation, failure rollback, and signed URL cache passed');
})().catch(error => { console.error(error); process.exitCode = 1; });

