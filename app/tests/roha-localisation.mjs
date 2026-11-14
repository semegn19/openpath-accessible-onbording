import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const bundle = await readFile(new URL('../dist/roha.js', import.meta.url), 'utf8');
const copy = JSON.parse(await readFile(new URL('../../schema/roha-copy-v1.json', import.meta.url))).strings;
let checks = 0;
const check = (ok, label) => { assert.ok(ok, label); checks++; console.log(`✓ ${label}`); };
const am = text => /[\u1200-\u137F]/.test(text) && !/\{(?:text|name|question|value|total|step|answered)\}/.test(text);
for (const [key, pair] of Object.entries(copy)) {
  const params = value => [...value.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  assert.deepEqual(params(pair.am), params(pair.en), key);
  assert.ok(/[\u1200-\u137F]/.test(pair.am), key);
}
check(true, 'all assistant copy has Amharic text and matching interpolation parameters');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.route('**/*', route => route.abort());
  await page.setContent('<html lang="am"><body><main><h1>ምዝገባ</h1><form></form><form><label for="name">ስም</label><input id="name"><label for="choice">ምርጫ</label><select id="choice"><option>አንድ</option></select><input id="unnamed"><button type="button"></button></form></main></body></html>');
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => {
    window.spoken = [];
    window.speechSynthesis.cancel = () => {};
    window.speechSynthesis.speak = utterance => { window.spoken.push(utterance); };
    window.map = window.Roha.mount({ language: 'am', root: document.querySelector('main') });
    window.reply = () => document.querySelector('[data-roha-control="roha-transcript"]').textContent;
    window.act = (intent, payload = {}, targetId = 'page.main') => window.Roha.executeIntent({ schemaVersion: '2.0', utteranceId: 'locale-test', mapId: window.map.mapId, mapVersion: window.map.mapVersion, intent, targetId, payload });
  });
  for (const [intent, payload, key] of [
    ['text_scale', {percent:150}, 'textScaled'], ['simple_mode',{enabled:true},'simpleOn'],
    ['simple_mode',{enabled:false},'simpleOff'], ['contrast',{theme:'high-contrast'},'contrastOn'],
    ['contrast',{theme:'default'},'contrastOff'], ['reduced_motion',{enabled:true},'motionOn'],
    ['reduced_motion',{enabled:false},'motionOff'], ['pause',{},'paused'], ['undo',{},'undone'],
    ['reset_preferences',{},'resetDone'],
  ]) {
    const result = await page.evaluate(([intent,payload]) => ({ result:window.act(intent,payload), text:window.reply() }), [intent,payload]);
    check(result.result.success && result.text === copy[`roha.${key}`].am.replace('{percent}','150'), `Amharic action feedback: ${key}`);
  }
  const invalid = await page.evaluate(() => ({ result:window.act('text_scale',{percent:123}), text:window.reply() }));
  check(!invalid.result.success && invalid.text === copy['roha.actionUnavailable'].am, 'invalid action shows translated feedback, not validator internals');
  const names = await page.evaluate(() => window.map.resources.map(r => r.name));
  check(names.includes('ቅጽ') && names.includes('የመልስ ቦታ') && names.includes('አዝራር'), `unlabelled discovered controls have Amharic fallback names: ${JSON.stringify(names)}`);
  const answer = await page.evaluate(() => {
    const target = window.map.resources.find(r => r.name === 'ስም');
    window.act('propose_answer',{value:'Sara $& {literal}'},target.id);
    return {text:window.reply(),value:document.querySelector('#name').value};
  });
  check(am(answer.text) && answer.text.includes('Sara $& {literal}') && answer.value === 'Sara $& {literal}', 'answer feedback preserves names and literal interpolation-like data');
  const speech = await page.evaluate(() => {
    window.act('resume');
    const utterance=window.spoken.at(-1),before=window.reply();
    utterance.onstart(); utterance.onerror();
    return {lang:utterance.lang,text:utterance.text,before,after:window.reply()};
  });
  check(speech.lang === 'am-ET' && am(speech.text) && speech.before.includes(speech.text), 'Amharic resume is visible before speech starts and uses am-ET');
  check(speech.before === speech.after, 'speech failure preserves the visible translated answer');
  const selected = await page.evaluate(() => {
    window.act('read',{},window.map.resources.find(r => r.name === 'ምርጫ').id);
    return window.spoken.at(-1).text;
  });
  check(selected.includes('አሁን የተመረጠው፦ አንድ') && !selected.includes('Current selection'), 'read-aloud selection prefix is translated');
  const convo = await page.evaluate(() => {
    const c = new window.RohaBundle.ConversationManager(); c.setLocale('am'); c.loadFields(window.map.resources);
    const proposal=c.proposeAnswer('Sara'); c.acceptProposedAnswer();
    return {proposal:proposal.promptText,review:c.getFormattedReviewSummary(),orientation:c.getOrientationSummary(),resume:c.getResumeRecap(),
      barriers:["don't understand","can't read","no document","can't type","someone helping","offline","don't want to answer","stuck"].map(text => c.handleImStuck(text).explanation),
      en:c.getFormattedReviewSummary('en')};
  });
  check([convo.proposal,convo.review,convo.orientation,convo.resume].every(am), 'confirmation, review, orientation and resume inherit the mounted language');
  check(convo.barriers.length === 8 && convo.barriers.every(am), 'all seven barrier responses and general help are translated');
  check(convo.en.includes('Here are all your recorded answers:'), 'English remains available explicitly');
  const voice = await page.evaluate(async () => {
    const states=[],errors=[];
    const manager=new window.RohaBundle.VoiceManager({onStateChange:(state,message)=>states.push({state,message}),onError:error=>errors.push(error),onTranscript:()=>{}},'am');
    manager.startListening();
    window.SpeechRecognition=undefined; window.webkitSpeechRecognition=undefined;
    await manager.requestPermission();
    window.SpeechRecognition=class { constructor(){window.recognition=this;} start(){} stop(){} abort(){} };
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{throw Object.assign(new Error('private browser detail'),{name:'NotAllowedError'});}}});
    await manager.requestPermission();
    navigator.mediaDevices.getUserMedia=async()=>({getTracks:()=>[{stop(){}}]});
    await manager.requestPermission(); manager.startListening(false);
    window.recognition.onerror({error:'audio-capture'}); window.recognition.onerror({error:'not-allowed'});
    manager.stopListening(); manager.destroy();
    return {states,errors,lang:window.recognition.lang};
  });
  check(voice.states.length >= 6 && voice.states.every(s=>am(s.message)) && voice.errors.length === 2 && voice.errors.every(am), 'permission, unsupported browser, listening and recognition errors use Amharic');
  check(voice.lang === 'am-ET' && !JSON.stringify(voice).includes('private browser detail'), 'recognition uses Amharic locale and hides browser diagnostics');
  const badges = await page.evaluate(() => ['unpermitted','ready','listening','processing','speaking','paused','error'].map(state=>{
    window.Roha.updateVoiceStatusUI(state);
    return document.querySelector('[data-roha-control="roha-voice-status-badge"]').textContent;
  }));
  check(badges.length === 7 && badges.every(am), 'all seven voice state badges are translated');
  const integration = await page.evaluate(async () => {
    const sms=window.Roha.getSMSService(); let message;
    sms.setGateway({id:'test',name:'Test',sendSMS:async(_phone,body)=>{message=body;return{success:true};}});
    const sent=await sms.createAndSendResumeLink('test-phone','test-form',{},2);
    sms.revokeToken(sent.token);
    const revoked=sms.redeemToken(sent.token),invalid=sms.redeemToken('missing');
    const expired=await sms.createAndSendResumeLink('test-phone','test-form',{},-1);
    const expiry=sms.redeemToken(expired.token);
    sms.setGateway({id:'test',name:'Test',sendSMS:async()=>{throw new Error('private diagnostic');}});
    const failed=await sms.createAndSendResumeLink('test-phone','test-form',{});
    const handoff=window.Roha.getHumanHandoffManager();
    handoff.setProvider({id:'test',name:'Test',requestAgentConnection:async()=>({success:false,error:'private diagnostic'})});
    const preview=handoff.generateContextPreview('ስም','am',{});
    const support=await handoff.submitSupportRequest('chat','test',preview);
    return {message,revoked:revoked.error,invalid:invalid.error,expiry:expiry.error,failed:failed.error,preview:preview.errorOrObstacleMessage,support:support.error};
  });
  check(Object.values(integration).every(am) && !JSON.stringify(integration).includes('private diagnostic'), 'SMS, resume errors and handoff responses follow Amharic locale and hide provider errors');
  await page.evaluate(async () => {
    window.fetch=async()=>new Response(JSON.stringify({provider:'disabled',model:'',revision:0}));
    await document.querySelector('[data-ai-options]').onclick();
  });
  check(await page.locator('[data-ai-description]').textContent() === copy['roha.aiDisabled'].am, 'disabled AI service explanation is translated');
  await page.evaluate(async () => {
    window.fetch=async()=>new Response(JSON.stringify({provider:'custom',model:'local-model-1',revision:1}));
    await document.querySelector('[data-ai-options]').onclick();
  });
  const description=await page.locator('[data-ai-description]').textContent();
  check(description.includes(copy['roha.aiCustom'].am) && description.includes('local-model-1') && !description.includes('Model:'), 'custom service description is translated while model identifiers are preserved');
  await page.evaluate(() => window.Roha.mount({language:'en',root:document.querySelector('main')}));
  const english=await page.evaluate(async()=>{await window.Roha.handleUserUtterance('bigger text');return window.reply();});
  check(english === 'Text size adjusted to 150%', 'language remount restores English action responses');
} finally { await browser.close(); }
console.log(`${checks}/${checks} localisation checks passed`);
