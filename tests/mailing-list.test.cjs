const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
// Pass the existing website directory; no dependencies need installing.
const website = path.resolve(process.argv[2] || process.env.POCKET_FUZZ_SITE || 'C:/dev/pocket-fuzz-site');
const deps = createRequire(path.join(website, 'package.json'));
const ts = deps('typescript');
const base = path.resolve(__dirname, '..');
function load(file, globals = {}, imports = deps) {
  const source = fs.readFileSync(path.join(base, file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: imports, Request, Response, URL, TextDecoder, Uint8Array, AbortSignal, AbortController, setTimeout, clearTimeout, ...globals }, { filename: file });
  return exports;
}
const env = { PFCOM_PURCHASE_CONTACT_URL: 'https://pf-com.example/api/purchase-contact', PFCOM_PURCHASE_CONTACT_SECRET: 'test-server-secret' };
const valid = { name: '  Pocket Fan  ', email: ' FAN@example.com ', subscribe: true };
function request(body = valid, headers = {}) {
  return new Request('https://pocket-fuzz.example/api/mailing-list', { method: 'POST', headers: { origin: 'https://pocket-fuzz.example', 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
}
function server(fetch = async () => Response.json({ok:true,subscribed:true}), vars = env) {
  return load('app/api/mailing-list/route.ts', { process: {env: vars}, fetch });
}
test('normalizes input, forwards consent and server secret, returns only success', async () => {
  let calls = 0;
  const api = server(async (url, options) => {
    calls++;
    assert.equal(url, env.PFCOM_PURCHASE_CONTACT_URL);
    assert.equal(options.headers['x-pocket-fuzz-secret'], env.PFCOM_PURCHASE_CONTACT_SECRET);
    assert.deepEqual(JSON.parse(options.body), {name:'Pocket Fan',email:'fan@example.com',subscribe:true});
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal);
    return Response.json({ok:true,subscribed:true,contactId:'private-id'});
  });
  const res = await api.POST(request());
  assert.equal(res.status,200);
  assert.equal(res.headers.get('cache-control'),'no-store');
  assert.deepEqual(await res.json(),{ok:true});
  assert.equal(calls,1);
});
test('invalid data, missing consent, bots and oversized bodies never reach PF-Com', async () => {
  let calls = 0;
  const api = server(async () => { calls++; throw Error('Must not call'); });
  for (const body of [{...valid,name:''},{...valid,name:'x'.repeat(121)},{...valid,email:'bad'},{...valid,subscribe:false},{...valid,subscribe:'true'},{...valid,website:'bot'},null,[], '{', 'x'.repeat(4097)]) {
    const res = await api.POST(request(body));
    assert.ok([400,413].includes(res.status));
  }
  assert.equal(calls,0);
});
test('cross-site and non-JSON requests are rejected', async () => {
  const api = server(() => {throw Error('Must not call')});
  assert.equal((await api.POST(request(valid,{origin:'https://evil.example'}))).status,403);
  assert.equal((await api.POST(request(valid,{'sec-fetch-site':'cross-site'}))).status,403);
  assert.equal((await api.POST(request(valid,{'content-type':'text/plain'}))).status,415);
  const req=request(); req.headers.delete('origin');
  assert.equal((await api.POST(req)).status,403);
});
test('missing or insecure configuration fails closed', async () => {
  for (const vars of [{}, {...env,PFCOM_PURCHASE_CONTACT_URL:'http://pf-com.example/api/purchase-contact'}, {...env,PFCOM_PURCHASE_CONTACT_SECRET:''}]) {
    assert.equal((await server(undefined,vars).POST(request())).status,503);
  }
});
test('upstream errors, malformed responses, timeouts and unconfirmed subscriptions stay private', async () => {
  const failures = [async()=>Response.json({error:'private secret'},{status:500}), async()=>new Response('not json'), async()=>Response.json({ok:true,subscribed:false}), async()=>{throw new DOMException('secret endpoint','TimeoutError')}];
  for(const fetch of failures){
    const res=await server(fetch).POST(request());
    assert.equal(res.status,502);
    const text=await res.text();
    assert.ok(!text.includes('secret') && !text.includes('contactId'));
  }
});
function nodes(element, result=[]) {
  if (!element || typeof element !== 'object') return result;
  result.push(element);
  for(const child of [element.props?.children].flat(Infinity)) nodes(child,result);
  return result;
}
function client(fetch) {
  const states=[];
  const react = {...deps('react'), useState:(value)=>[value,(next)=>states.push(next)],useRef:(value)=>({current:value})};
  const component=load('components/home-client.tsx',{ fetch, FormData:class {get(key){return {name:'Fan',email:'fan@example.com',subscribe:'on',website:''}[key]}} }, name=>name==='react'?react:deps(name));
  const tree=component.default({upcomingShows:[]});
  const all=nodes(tree);
  const index=all.findIndex(n=>typeof n.type==='function' && n.type.name==='MailingListSection');
  assert.ok(index>all.findIndex(n=>n.props?.id==='shows'));
  assert.ok(index<all.findIndex(n=>n.props?.id==='music'));
  const section=all[index].type();
  return {elements:nodes(section),states};
}
test('form sits below shows with labeled required inputs and unchecked consent',()=>{
  const {elements}=client();
  for(const name of ['name','email','subscribe']) assert.equal(elements.find(n=>n.type==='input' && n.props.name===name).props.required,true);
  const consent=elements.find(n=>n.props?.name==='subscribe');
  assert.equal(consent.props.defaultChecked,undefined);
  assert.equal(consent.props.checked,undefined);
  assert.ok(elements.some(n=>n.props?.role==='status'));
});
test('client shows loading then success, resets only on success, and blocks concurrent submits',async()=>{
  let resolve, calls=0,reset=0;
  const {elements,states}=client(()=>{calls++;return new Promise(r=>resolve=r)});
  const submit=elements.find(n=>n.type==='form').props.onSubmit;
  const event={preventDefault(){},currentTarget:{reset(){reset++}}};
  const pending=submit(event);
  await submit(event);
  assert.equal(calls,1); assert.equal(states[0],'loading');
  resolve(Response.json({ok:true})); await pending;
  assert.ok(states.includes('success')); assert.equal(reset,1);
});
test('client preserves form and displays an error on failure, then allows retry',async()=>{
  let reset=0,calls=0;
  const {elements,states}=client(async()=>{calls++; return Response.json({error:'Try again shortly.'},{status:502})});
  const submit=elements.find(n=>n.type==='form').props.onSubmit;
  const event={preventDefault(){},currentTarget:{reset(){reset++}}};
  await submit(event); await submit(event);
  assert.equal(calls,2); assert.equal(reset,0); assert.ok(states.includes('error')); assert.ok(states.includes('Try again shortly.'));
});
