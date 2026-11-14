import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:430,height:900} });
// force a language-not-supported result so the {langs} clause is what renders
await p.addInitScript(() => {
  class FakeRec {
    lang=''; onresult=null; onerror=null; onend=null;
    start(){ setTimeout(()=>{ this.onerror?.({ error:'language-not-supported' }); this.onend?.(); }, 20); }
    stop(){}
  }
  window.webkitSpeechRecognition = FakeRec; window.SpeechRecognition = FakeRec;
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{lang:'am-ET',name:'a'}],speak:()=>{},cancel:()=>{}}});
  Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class{constructor(t){this.text=t;}}});
});
await p.goto('http://127.0.0.1:4173/onboard');
await p.waitForSelector('.op-progress');
await p.getByText('አማርኛ', { exact:true }).first().click({ force:true });
await p.waitForTimeout(250);
// walk to the phone step, where the mic lives
for (let i=0;i<6;i++){
  if (await p.locator('.op-root input[type=tel]').count()) break;
  await p.locator('.op-root button').last().click({timeout:3000}).catch(()=>{});
  await p.waitForTimeout(200);
}
await p.getByRole('button', { name: /በድምጽ|Speak your answer/ }).first().click();
await p.waitForTimeout(700);
const txt = (await p.innerText('.op-root')).split('\n').map(s=>s.trim()).filter(Boolean);
console.log(txt.filter(l => /ሞዴል|አሳሽ|ማይክሮፎን|ድምጽ/.test(l)).join('\n'));
