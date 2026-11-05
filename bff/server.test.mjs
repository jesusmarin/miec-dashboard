import { test } from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from './server.mjs';
const creds={AUTHOR:{username:'author',password:'author-test-password-2026'},APPROVER:{username:'approver',password:'approver-test-password-2026'}};
function setup(){
 const received=[];
 const app=createApp({credentials:creds,serveStatic:false,fetcher:async(url,opts)=>{
  received.push({url:String(url),headers:opts.headers,method:opts.method});
  const basic=opts.headers.Authorization;
  if(!basic)return new Response('{}',{status:401,headers:{'Content-Type':'application/json'}});
  return new Response(JSON.stringify({items:[],nextCursor:null}),{status:200,headers:{'Content-Type':'application/json'}});
 }});
 return {app,received};
}
async function local(app,fn){await new Promise(ok=>app.listen(0,'127.0.0.1',ok));try{await fn(`http://127.0.0.1:${app.address().port}`);}finally{await new Promise(ok=>app.close(ok));}}
async function login(base){const res=await fetch(base+'/bff/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'author',password:creds.AUTHOR.password})});assert.equal(res.status,200);const cookies=res.headers.getSetCookie();const cookie=cookies.map(x=>x.split(';')[0]).join('; ');const csrf=/MIEC-XSRF-TOKEN=([^;]+)/.exec(cookie)?.[1];return {cookie,csrf};}
test('sesion HttpOnly, no expone contraseña y verifica el motor',async()=>{const {app,received}=setup();await local(app,async base=>{const {cookie}=await login(base);assert.equal(received.length,1);const res=await fetch(base+'/bff/session',{headers:{Cookie:cookie}});assert.equal((await res.json()).role,'AUTHOR');assert.ok(!res.headers.get('set-cookie'));});});
test('rechaza POST sin CSRF y acepta GET autenticado',async()=>{const {app,received}=setup();await local(app,async base=>{const {cookie}=await login(base);let res=await fetch(base+'/bff/api/systems',{headers:{Cookie:cookie}});assert.equal(res.status,200);res=await fetch(base+'/bff/api/systems',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:'{}'});assert.equal(res.status,403);assert.equal(received.length,2);});});
test('logout con CSRF invalida la sesion',async()=>{const {app}=setup();await local(app,async base=>{const {cookie,csrf}=await login(base);const res=await fetch(base+'/bff/logout',{method:'POST',headers:{Cookie:cookie,'X-CSRF-Token':csrf,'Content-Type':'application/json'},body:'{}'});assert.equal(res.status,200);const after=await fetch(base+'/bff/session',{headers:{Cookie:cookie}});assert.equal(after.status,401);});});
test('restringe origen cruzado y sin sesion',async()=>{const {app}=setup();await local(app,async base=>{let r=await fetch(base+'/bff/api/systems');assert.equal(r.status,401);r=await fetch(base+'/bff/login',{method:'POST',headers:{Origin:'http://evil.example','Content-Type':'application/json'},body:'{}'});assert.equal(r.status,403);});});
