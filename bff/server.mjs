import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/miec-dashboard/browser');
const SESSION_MS = 30 * 60 * 1000;
const MAX_BODY = 256 * 1024;
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.ico':'image/x-icon','.svg':'image/svg+xml','.json':'application/json; charset=utf-8' };
const noStore = {'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer', 'X-Frame-Options':'DENY', 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"};
function json(res,status,payload,extra={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',...noStore,...extra});res.end(JSON.stringify(payload));}
function eq(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
function cookies(req){return Object.fromEntries((req.headers.cookie??'').split(';').map(x=>x.trim().split('=')).filter(x=>x.length===2));}
function body(req){return new Promise((resolve,reject)=>{let count=0,chunks=[];req.on('data',b=>{count+=b.length;if(count>MAX_BODY){reject(new Error('BODY_TOO_LARGE'));req.destroy();}else chunks.push(b);});req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject);});}
function sameOrigin(req,base){const origin=req.headers.origin;if(origin&&origin!==base)return false;const site=req.headers['sec-fetch-site'];return !site||site==='same-origin'||site==='none';}
function authConfig(){const a=process.env.MIEC_AUTHOR_USERNAME??'author',p=process.env.MIEC_APPROVER_USERNAME??'approver';const ap=process.env.MIEC_AUTHOR_PASSWORD??'',pp=process.env.MIEC_APPROVER_PASSWORD??'';
 if(!ap||!pp||ap.length<12||pp.length<12||a===p||ap===pp) throw new Error('Credenciales AUTHOR y APPROVER válidas e independientes requeridas');
 return {AUTHOR:{username:a,password:ap},APPROVER:{username:p,password:pp}};
}
export function createApp({engineOrigin=process.env.MIEC_ENGINE_ORIGIN??'http://127.0.0.1:8081', credentials=authConfig(), fetcher=fetch, serveStatic=true}={}) {
 const engine=new URL(engineOrigin);if(engine.protocol!=='http:'||engine.hostname!=='127.0.0.1'||engine.username||engine.password||engine.search||engine.hash||engine.pathname!=='/')throw new Error('Motor solo HTTP loopback 127.0.0.1 para laboratorio');
 const sessions=new Map();const attempts=new Map();
 const server=http.createServer(async(req,res)=>{
  const origin=`http://127.0.0.1:${server.address()?.port??4300}`;
  const u=new URL(req.url??'/',origin),pathname=u.pathname;
  if(u.origin!==origin){return json(res,400,{code:'INVALID_TARGET'});}
  if(!sameOrigin(req,origin)){return json(res,403,{code:'CROSS_ORIGIN_REJECTED'});}
  // Browser security headers and no caching for all dynamic endpoints.
  const c=cookies(req),s=sessions.get(c['miec_sid']);
  if(s&&s.expires<=Date.now()){sessions.delete(c['miec_sid']);}
  const session=s&&s.expires>Date.now()?s:null;
  const secure=false; // HTTP loopback-only laboratory; use HTTPS before nonlocal deployment.
  const cookieFlags=`Path=/; SameSite=Strict${secure?'; Secure':''}`;
  try {
   if(pathname==='/bff/login'&&req.method==='POST'){
    if(req.headers['content-type']?.split(';')[0]!=='application/json')return json(res,415,{code:'JSON_REQUIRED'});
    const recent=attempts.get(req.socket.remoteAddress)??[];const valid=recent.filter(t=>t>Date.now()-60000);
    if(valid.length>=8)return json(res,429,{code:'LOGIN_LIMIT'});
    valid.push(Date.now());attempts.set(req.socket.remoteAddress,valid);
    let data;try{data=JSON.parse((await body(req)).toString('utf8'));}catch{return json(res,400,{code:'INVALID_LOGIN'});}
    if(typeof data.username!=='string'||typeof data.password!=='string'||Object.keys(data).some(k=>!['username','password'].includes(k)))return json(res,400,{code:'INVALID_LOGIN'});
    let role=null;for(const [r,user] of Object.entries(credentials)){if(eq(user.username,data.username)&&eq(user.password,data.password))role=r;}
    if(!role)return json(res,401,{code:'LOGIN_FAILED'});
    // Confirm the same credentials actually work on the MIEC API.
    let upstream;try{upstream=await fetcher(new URL('/api/systems?limit=1',engine),{headers:{'Authorization':'Basic '+Buffer.from(`${data.username}:${data.password}`).toString('base64')},signal:AbortSignal.timeout(7000)});}catch{return json(res,503,{code:'ENGINE_UNAVAILABLE'});}
    if(!upstream.ok)return json(res,503,{code:'ENGINE_AUTH_NOT_VERIFIED'});
    if(session)sessions.delete(c['miec_sid']);
    const sid=randomBytes(32).toString('base64url'),csrf=randomBytes(24).toString('base64url');
    const item={role,username:data.username,csrf,expires:Date.now()+SESSION_MS};sessions.set(sid,item);
    return json(res,200,{username:item.username,role,expiresAt:new Date(item.expires).toISOString()},{'Set-Cookie':[`miec_sid=${sid}; HttpOnly; ${cookieFlags}`,`MIEC-XSRF-TOKEN=${csrf}; ${cookieFlags}`]});
   }
   if(pathname==='/bff/session'&&req.method==='GET')return session?json(res,200,{username:session.username,role:session.role,expiresAt:new Date(session.expires).toISOString()}):json(res,401,{code:'LOGIN_REQUIRED'});
   if(pathname.startsWith('/bff/')){
    if(!session)return json(res,401,{code:'LOGIN_REQUIRED'});
    if(req.method!=='GET'&&!(req.headers['x-csrf-token']&&eq(String(req.headers['x-csrf-token']),session.csrf)&&eq(c['MIEC-XSRF-TOKEN']??'',session.csrf)))return json(res,403,{code:'CSRF_REJECTED'});
    if(pathname==='/bff/logout'&&req.method==='POST'){
     sessions.delete(c['miec_sid']);return json(res,200,{ok:true},{'Set-Cookie':[`miec_sid=; HttpOnly; ${cookieFlags}; Max-Age=0`,`MIEC-XSRF-TOKEN=; ${cookieFlags}; Max-Age=0`]});
    }
    if(!pathname.startsWith('/bff/api/')||!['GET','POST'].includes(req.method))return json(res,404,{code:'UNSUPPORTED_ROUTE'});
    const rest=pathname.slice('/bff'.length);if(!/^\/api\/[A-Za-z0-9._\-/]+$/.test(rest)||rest.includes('..'))return json(res,400,{code:'INVALID_PATH'});
    const account=credentials[session.role];
    const headers={'Authorization':'Basic '+Buffer.from(account.username+':'+account.password).toString('base64'),'Accept':'application/json'};
    let raw;if(req.method==='POST'){
     if(req.headers['content-type']?.split(';')[0]!=='application/json')return json(res,415,{code:'JSON_REQUIRED'});
     raw=await body(req);headers['Content-Type']='application/json';
    }
    let upstream;try{upstream=await fetcher(new URL(rest+u.search,engine),{method:req.method,headers,body:raw,redirect:'manual',signal:AbortSignal.timeout(15000)});}catch{return json(res,502,{code:'ENGINE_UNAVAILABLE'});}
    if(upstream.status>=300&&upstream.status<400)return json(res,502,{code:'UNEXPECTED_REDIRECT'});
    const payload=await upstream.arrayBuffer();if(payload.byteLength>1024*1024)return json(res,502,{code:'RESPONSE_TOO_LARGE'});
    const outType=upstream.headers.get('content-type')??'';
    if(!outType.includes('application/json')&&upstream.status!==204)return json(res,502,{code:'UNEXPECTED_CONTENT_TYPE'});
    const out={...noStore,'Content-Type':outType||'application/json'};
    res.writeHead(upstream.status,out);return res.end(Buffer.from(payload));
   }
   if(req.method!=='GET'||!serveStatic)return json(res,404,{code:'NOT_FOUND'});
   const clean=pathname==='/'?'index.html':pathname.slice(1);
   const target=path.resolve(root,clean);if(!target.startsWith(root+path.sep)&&target!==path.join(root,'index.html'))return json(res,404,{code:'NOT_FOUND'});
   let data;let filename=target;
   try{const st=await stat(filename);if(!st.isFile())throw new Error();data=await readFile(filename);}catch{
    // Angular HTML5 router fallback only for paths without file extensions.
    if(path.extname(clean))return json(res,404,{code:'NOT_FOUND'});
    filename=path.join(root,'index.html');try{data=await readFile(filename);}catch{return json(res,503,{code:'FRONTEND_NOT_BUILT'});}
   }
   res.writeHead(200,{'Content-Type':mime[path.extname(filename)]??'application/octet-stream',...noStore});res.end(data);
  }catch{return json(res,500,{code:'BFF_ERROR'});}
 });
 return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const server=createApp();server.listen(4300,'127.0.0.1',()=>process.stdout.write('MIEC Dashboard: http://127.0.0.1:4300\n'));
}
