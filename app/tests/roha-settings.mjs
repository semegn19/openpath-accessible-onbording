import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
const browser=await chromium.launch();let checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++;console.log(`✓ ${label}`);};
const base=process.env.ORIGIN || 'http://127.0.0.1:5173';
try {
  const context=await browser.newContext({viewport:{width:320,height:700}});const page=await context.newPage();
  let signedIn=false;let saved={provider:'disabled',model:'',endpoint:'',revision:0,requestsPerDay:1000,hasKey:false};let tested;
  await page.route('**/api/admin/**',async route=>{
    const request=route.request();const path=new URL(request.url()).pathname;const method=request.method();
    if(path.endsWith('/session')){signedIn=method==='POST';return route.fulfill({json:{ok:true}});}
    if(!signedIn)return route.fulfill({status:401,json:{error:{code:'sign-in-required'}}});
    if(path.endsWith('/test')){tested=request.postDataJSON();return route.fulfill({json:{ok:true}});}
    if(method==='PUT'){const data=request.postDataJSON();saved={...data,apiKey:undefined,hasKey:Boolean(data.apiKey),revision:saved.revision+1};}
    return route.fulfill({json:saved});
  });
  await page.goto(base+'/roha-admin.html');
  check((await new AxeBuilder({page}).analyze()).violations.length===0,'administrator login axe clean at 320px');
  await page.locator('#token').fill('test-token');await page.locator('#login button').click();await page.locator('#provider').waitFor({state:'visible'});
  check(await page.locator('#provider').evaluate(e=>e===document.activeElement),'sign-in moves focus to provider selection');
  await page.locator('#provider').selectOption('openai');await page.locator('#model').fill('test-model');await page.locator('#key').fill('private-test-key');
  await page.locator('#test').click();await page.waitForFunction(()=>!document.querySelector('#test').disabled);
  check(tested?.apiKey==='private-test-key' && await page.locator('#key').inputValue()==='private-test-key','connection test retains unsaved key for subsequent save');
  await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#key-state').textContent.length>0 && !document.querySelector('#save').disabled);
  check(saved.provider==='openai' && saved.hasKey && await page.locator('#key').inputValue()==='','saving clears the credential input');
  check((await new AxeBuilder({page}).analyze()).violations.length===0,'administrator settings axe clean at 320px');
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'administrator settings do not overflow at 320px');
  check(await page.evaluate(()=>!JSON.stringify({...localStorage}).includes('private-test-key')),'browser storage contains no administrator provider key');
  await page.locator('#provider').selectOption('gemini');check(await page.locator('#key').inputValue()==='' && await page.locator('#endpoint-field').isHidden(),'switching hosted provider clears key and hides endpoint field');
  await page.locator('#provider').selectOption('ollama');check(await page.locator('#endpoint').isVisible(),'Ollama exposes approved endpoint field');
  await page.locator('#logout').click();await page.locator('#token').waitFor({state:'visible'});check(await page.locator('#token').evaluate(e=>e===document.activeElement),'logout restores login focus');

  let aiCalls=0, configRevision=1, changed=false, release, delayed=false;
  await page.route('**/api/assistant/config',route=>route.fulfill({json:{provider:'openai',model:'test-model',revision:configRevision}}));
  await page.route('**/api/assistant/interpret',async route=>{
    aiCalls++;const input=route.request().postDataJSON();
    if(delayed)await new Promise(r=>{release=r;});
    if(changed)return route.fulfill({status:409,json:{error:{code:'provider-changed'}}});
    return route.fulfill({json:{intent:{schemaVersion:'2.0',utteranceId:'test-ai',mapId:input.map.mapId,mapVersion:input.map.mapVersion,intent:'text_scale',targetId:'page.main',payload:{percent:200}}}});
  });
  await page.goto(base+'/onboard',{waitUntil:'networkidle'});
  await page.evaluate(()=>window.Roha.mount({root:document.querySelector('main'),language:'en'}));
  await page.locator('[data-roha-control="roha-launcher-pill"]').click();
  const input=page.getByRole('dialog').getByRole('textbox');
  await page.locator('[data-ai-options]').click();await page.locator('[data-ai-consent]').waitFor({state:'visible'});
  check(!await page.locator('[data-ai-consent]').isChecked(),'AI consent is unchecked initially');
  await input.fill('Please make the letters gigantic for me');await input.press('Enter');
  check(aiCalls===0,'typed request does not contact AI before consent');
  await page.locator('[data-ai-consent]').check();
  check((await new AxeBuilder({page}).include('.roha-aside').analyze()).violations.length===0,'consent controls have accessible names and contrast');
  await input.fill('Please make the letters gigantic for me');await input.press('Enter');
  await page.waitForFunction(()=>document.documentElement.dataset.rohaScale==='200');
  check(aiCalls===1,'consented server response changes real text scale');
  await page.locator('[data-roha-control="roha-btn-reset"]').click();
  delayed=true;await input.fill('Please make the letters gigantic for me');await input.press('Enter');
  for(let i=0;i<100 && !release;i++)await new Promise(r=>setTimeout(r,10));assert.ok(release);
  await page.locator('[data-roha-control="roha-btn-stop"]').click();release();delayed=false;
  await page.waitForTimeout(150);
  check(await page.locator('html').getAttribute('data-roha-scale')===null,'Stop prevents delayed AI response from changing the page');
  changed=true;configRevision=2;await input.fill('Please make the letters gigantic for me');await input.press('Enter');
  await page.waitForFunction(()=>document.querySelector('[data-ai-consent]').disabled);
  check(!await page.locator('[data-ai-consent]').isChecked(),'provider change visibly revokes old consent');
  await page.locator('[data-ai-options]').click();await page.waitForFunction(()=>!document.querySelector('[data-ai-consent]').disabled);
  check(!await page.locator('[data-ai-consent]').isChecked(),'reviewing new provider still requires a new consent choice');
  const focusResult=await page.evaluate(()=>{
    const map=window.Roha.getMap();const target=map.resources.find(r=>r.kind==='field' && r.allowedIntents.includes('focus'));
    if(!target)throw new Error('No focusable field discovered');
    return window.Roha.executeIntent({schemaVersion:'2.0',utteranceId:'focus-test',mapId:map.mapId,mapVersion:map.mapVersion,intent:'focus',targetId:target.id,payload:{}});
  });
  await page.waitForFunction(()=>!document.querySelector('.roha-aside dialog').open);
  check(focusResult.success && await page.evaluate(()=>!!document.activeElement?.closest('main')),'focus action closes modal and leaves focus in the host form');

  await page.goto(base+'/blank-host.html',{waitUntil:'networkidle'});
  check(await page.locator('.roha-aside').count()===1 && await page.evaluate(()=>!!document.querySelector('roha-agent').getSDK()),'declarative plugin mounts on the named host root');
  check(await page.evaluate(()=>!!customElements.get('roha-agent') && !!customElements.get('roha-assistant')),'both custom-element aliases register');
  await page.evaluate(()=>document.querySelector('roha-agent').remove());
  check(await page.locator('.roha-aside').count()===0,'removing plugin cleans up assistant panel');
  await page.evaluate(()=>{const el=document.createElement('roha-assistant');el.setAttribute('for','main');el.setAttribute('language','en');document.body.append(el);});
  await page.locator('.roha-aside').waitFor();check(await page.evaluate(()=>!!document.querySelector('roha-assistant').getSDK()),'alias mounts after original element disconnects');
  const error=await page.evaluate(()=>new Promise(resolve=>{const el=document.querySelector('roha-assistant');el.addEventListener('roha:error',e=>resolve(e.detail.code),{once:true});el.setAttribute('for','missing-root');}));
  check(error==='target-not-found' && await page.locator('.roha-aside').count()===0,'missing plugin target emits error without attaching to unrelated content');
  await context.close();
} finally {await browser.close();}
console.log(`${checks}/${checks} administrator, consent and plugin browser checks passed (mock API)`);
