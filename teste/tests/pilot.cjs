const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=process.env.PILOT_REPO_ROOT||path.resolve(__dirname,'../..');
const users={a:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'teste-a@example.com'},b:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',email:'teste-b@example.com'}};
const rows=new Map(),hotels=[],rates=[];let failWrites=false,writeDelay=0,hotelFailOnce=false;
const copy=x=>JSON.parse(JSON.stringify(x));
const token=u=>['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:u.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url'),'test'].join('.');
const server=http.createServer((req,res)=>{let name=path.join(root,new URL(req.url,'http://a').pathname);if(fs.existsSync(name)&&fs.statSync(name).isDirectory())name+='/index.html';try{let b=fs.readFileSync(name);res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':'text/html');res.end(b)}catch{res.statusCode=404;res.end('not found')}});
(async()=>{
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/teste/';
const browser=await chromium.launch({headless:true,...(process.env.PILOT_CHROME_PATH?{executablePath:process.env.PILOT_CHROME_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{} )});const context=await browser.newContext({acceptDownloads:true});let errors=[];
await context.route('https://sgatwaxxxdmbftybkeom.supabase.co/**',async route=>{
 let req=route.request(),u=new URL(req.url()),method=req.method(),body=req.postDataJSON?.(),auth=req.headers().authorization||'',user=Object.values(users).find(v=>auth.includes(token(v)))||users.a;
 const respond=(status,obj)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(obj),headers:{'access-control-allow-origin':'*'}});
 if(u.pathname==='/auth/v1/token'){
   let user=body.email===users.b.email?users.b:users.a;
   if(body.password!=='TesteSenha123!')return respond(400,{code:'invalid_credentials',msg:'Invalid login credentials'});
   return respond(200,{access_token:token(user),refresh_token:'refresh-'+user.id,token_type:'bearer',expires_in:3600,user:{...user,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}});
 }
 if(u.pathname==='/auth/v1/user')return respond(200,{...user,aud:'authenticated',app_metadata:{},user_metadata:{}});
 if(u.pathname==='/auth/v1/logout')return respond(200,{});
 if(u.pathname==='/rest/v1/ac_dados_usuario'){
   assert.equal(u.searchParams.get('usuario_id'),method==='POST'?null:'eq.'+user.id,'user filter required');
   if(method==='GET'){let row=rows.get(user.id);return respond(200,row?[copy(row)]:[])}
   if(failWrites)return route.abort('failed');
   if(writeDelay)await new Promise(r=>setTimeout(r,writeDelay));
   if(method==='POST'){
     assert.equal(body.usuario_id,user.id);if(rows.has(user.id))return respond(409,{code:'23505'});
     let row={usuario_id:user.id,dados:body.dados,versao:1};rows.set(user.id,row);return respond(201,[row]);
   }
   if(method==='PATCH'){
     let row=rows.get(user.id);if(!row||u.searchParams.get('versao')!=='eq.'+row.versao)return respond(200,[]);
     row.dados=copy(body.dados);row.versao++;return respond(200,[copy(row)]);
   }
 }
 if(u.pathname==='/rest/v1/ac_hoteis'){
   if(method==='GET')return respond(200,hotels.filter(h=>!u.searchParams.has('id')||u.searchParams.get('id')==='eq.'+h.id));
   if(method==='POST'){
     assert.equal(body.criado_por,user.id);if(hotels.some(h=>h.nome.toLowerCase()===body.nome.toLowerCase()&&h.cidade===body.cidade&&h.uf===body.uf))return respond(409,{code:'23505'});
     hotels.push(copy(body));return respond(201,{});
   }
 }
 if(u.pathname==='/rest/v1/ac_diarias'){
   if(method==='GET')return respond(200,rates.filter(r=>(!u.searchParams.has('hotel_id')||u.searchParams.get('hotel_id')==='eq.'+r.hotel_id)&&(!u.searchParams.has('id')||u.searchParams.get('id')==='eq.'+r.id)).reverse());
   if(method==='POST'){
     if(rates.some(r=>r.id===body.id))return respond(409,{code:'23505'});
     rates.push({...copy(body),criado_em:new Date().toISOString()});if(hotelFailOnce){hotelFailOnce=false;return route.abort('failed')};return respond(201,{});
   }
 }
 console.log('Unexpected request',method,u.href);return respond(400,{message:'unexpected'});
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
await page.addInitScript(()=>localStorage.setItem('kb-real',JSON.stringify({production:'untouched'})));
await page.goto(url);await page.waitForSelector('#pilotLoginButton');
assert.equal(await page.locator('.layout').isVisible(),false);
async function login(user){await page.fill('[name=email]',user.email);await page.fill('[name=password]','TesteSenha123!');await page.click('#pilotLoginButton');await page.waitForFunction(()=>pilot.ready)}
await login(users.a);
assert.equal(await page.evaluate(()=>data.services.length),0,'must not import production data');
await page.evaluate(()=>{data=demoData();persist()});await page.waitForFunction(()=>!pilot.dirty&&!pilot.busy);assert.equal(rows.get(users.a.id).versao,1);
assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('kb-real'))),{production:'untouched'});
console.log('PASS: login, production isolation, initial cloud insert');
let beforeReceipts=rows.get(users.a.id).dados.receipts.length;
await page.evaluate(()=>finishService('s3'));await page.waitForFunction(()=>!pilot.dirty&&!pilot.busy);
assert.equal(rows.get(users.a.id).dados.services.find(s=>s.id==='s3').status,'done');assert.equal(rows.get(users.a.id).dados.receipts.length,beforeReceipts);assert.ok(rows.get(users.a.id).dados.services.find(s=>s.id==='s3').paymentDue);
console.log('PASS: service finalization independent of receipts');
// Two rapid saves while the first network write is in flight must both survive.
writeDelay=250;
await page.evaluate(()=>{data.identity={name:'Primeiro nome',role:'Consultor',logo:''};persist();pilotSync()});
await page.waitForTimeout(80);
await page.evaluate(()=>{data.identity.name='Nome final';persist()});
await page.waitForFunction(()=>!pilot.dirty&&!pilot.busy);writeDelay=0;
assert.equal(rows.get(users.a.id).dados.identity.name,'Nome final');console.log('PASS: edits queued during in-flight write');
// Offline draft survives reload and is sent with its original expected version.
failWrites=true;await page.evaluate(()=>{data.identity.name='Alterado sem internet';persist();pilotSync()});await page.waitForFunction(()=>!pilot.busy&&pilot.dirty);
await page.reload();await page.waitForFunction(()=>pilot.ready&&pilot.dirty);failWrites=false;await page.evaluate(()=>pilotSync());await page.waitForFunction(()=>!pilot.dirty&&!pilot.busy);
assert.equal(rows.get(users.a.id).dados.identity.name,'Alterado sem internet');console.log('PASS: pending draft survives reload and retries');
// Another device wins. Keep the local draft and require recovery, never overwrite.
let remote=rows.get(users.a.id);remote.dados.identity.name='Outro aparelho';remote.versao++;
await page.evaluate(()=>{data.identity.name='Minha edição pendente';persist();pilotSync()});await page.waitForFunction(()=>pilot.conflict);
assert.equal(rows.get(users.a.id).dados.identity.name,'Outro aparelho');assert.equal(await page.locator('#pilotUseRemote').isDisabled(),true);
let downloadPromise=page.waitForEvent('download');await page.click('#pilotDraftDownload');let downloaded=await downloadPromise;assert.ok(downloaded.suggestedFilename().includes('Pendente'));
await page.click('#pilotUseRemote');await page.waitForFunction(()=>!pilot.conflict);assert.equal(await page.evaluate(()=>data.identity.name),'Outro aparelho');
console.log('PASS: multi-device conflict preserves remote and local recovery copy');
// Shared data stays separate. Existing expenses retain their contracted rate.
await page.click('[data-page=hotels]');await page.waitForFunction(()=>pilot.hotelsLoaded);await page.click('#sharedNew');
await page.fill('#sharedHotelForm [name=nome]','Hotel Horizonte');await page.fill('#sharedHotelForm [name=cidade]','Jequié');await page.fill('#sharedHotelForm [name=telefone]','73999999999');await page.click('[form=sharedHotelForm]');await page.waitForFunction(()=>pilot.hotels.length===1);
assert.equal(hotels.length,1);assert.ok(!('notes' in hotels[0]));assert.equal(hotels[0].criado_por,users.a.id);
await page.click('[data-shared=rate]');await page.fill('#sharedRateForm [name=valor]','180');await page.fill('#sharedRateForm [name=tipo_quarto]','Individual com café');await page.click('[form=sharedRateForm]');await page.waitForFunction(()=>!pilot.sharedBusy);
assert.equal(rates.length,1);await page.click('[data-shared=details]');await page.waitForSelector('#sharedUse');await page.click('#sharedUse');await page.waitForFunction(()=>!pilot.dirty&&!pilot.busy);
assert.equal(rows.get(users.a.id).dados.hotels.find(h=>h.name==='Hotel Horizonte').rates[0].nightly,180);
assert.equal(rows.get(users.a.id).dados.expenses.find(e=>e.id==='e1').nightly,120);
console.log('PASS: shared hotel, rate history, private copy, unchanged contracted expense');
// Lost rate response: retry same form retains the same id.
hotelFailOnce=true;await page.click('[data-shared=rate]');await page.fill('#sharedRateForm [name=valor]','190');await page.click('[form=sharedRateForm]');await page.waitForFunction(()=>!pilot.sharedBusy);assert.equal(rates.length,2);await page.click('[form=sharedRateForm]');await page.waitForFunction(()=>!pilot.sharedBusy);assert.equal(rates.length,2);
console.log('PASS: lost response retry does not duplicate shared rate');
// New account sees shared hotels, never the previous user's private snapshot.
await page.click('#pilotLogout');await page.waitForSelector('#pilotLoginButton',{state:'visible'});await login(users.b);assert.equal(await page.evaluate(()=>data.services.length),0);await page.click('[data-page=hotels]');await page.waitForFunction(()=>pilot.hotelsLoaded);assert.equal(await page.evaluate(()=>pilot.hotels.length),1);assert.equal(await page.evaluate(()=>data.hotels.length),0);
console.log('PASS: account isolation and shared catalog visibility');
// Mobile layout and clean runtime.
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/pilot-mobile.png',fullPage:true});
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile page should not overflow horizontally');
assert.deepEqual(errors,[]);console.log('PASS: mobile width and no JavaScript errors');
await browser.close();await new Promise(r=>server.close(r));
})().catch(e=>{console.error(e);process.exit(1)});
