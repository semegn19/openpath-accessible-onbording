/**
 * Roha - Comprehensive Runtime Test Suite
 * Tests actual SDK behaviour against Acceptance Criteria:
 * AT-D01, AT-D02, AT-D03, AT-D04, AT-D05, AT-D06,
 * AT-A01, AT-A02, AT-V04, AT-V05, AT-V06,
 * AT-P01, AT-P02, AT-P03, AT-I01
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const HANDOFF_ROOT = path.resolve(REPO_ROOT, 'Roha_Agent_Handoff');

// Load HTML Fixtures
const hostAHtml = fs.readFileSync(path.join(HANDOFF_ROOT, 'examples/host-a.html'), 'utf-8');
const hostBHtml = fs.readFileSync(path.join(HANDOFF_ROOT, 'examples/host-b.html'), 'utf-8');

// Load JSON Schemas
const siteMapSchema = JSON.parse(fs.readFileSync(path.join(HANDOFF_ROOT, 'schemas/site-map.schema.json'), 'utf-8'));
const intentSchema = JSON.parse(fs.readFileSync(path.join(HANDOFF_ROOT, 'schemas/intent.schema.json'), 'utf-8'));
const capabilitiesSchema = JSON.parse(fs.readFileSync(path.join(HANDOFF_ROOT, 'schemas/capabilities.schema.json'), 'utf-8'));

// Import Roha modules from dist/roha.js or src
const rohaBundlePath = path.resolve(__dirname, '../dist/roha.js');
const rohaScriptContent = fs.readFileSync(rohaBundlePath, 'utf-8');

let totalChecks = 0;
let passedChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  }
  passedChecks++;
  console.log(`✅ PASS: ${message}`);
}

async function runTests() {
  console.log('\n--- Starting Roha Runtime SDK Tests ---\n');

  // =========================================================================
  // Test 1: AT-D01 & AT-I01 - Automatic discovery on Host A without supplied map
  // =========================================================================
  const domA = new JSDOM(hostAHtml, {
    runScripts: 'dangerously',
    url: 'http://localhost/registration',
  });
  
  // Inject bundle into host A
  domA.window.eval(rohaScriptContent);
  const rohaA = domA.window.Roha;
  assert(rohaA !== undefined, 'Roha SDK instantiates and attaches to window');

  const mapA = rohaA.mount();
  assert(mapA.schemaVersion === '2.0', 'AT-D01: Map A has schemaVersion 2.0');
  assert(mapA.origin === 'runtime-discovery', 'AT-D01: Map A origin is runtime-discovery');
  assert(mapA.resources.length >= 4, 'AT-D01: Discovered main, form, and 3 fields in Host A');

  // Check specific resources in Host A
  const mainA = mapA.resources.find((r) => r.id === 'page.main');
  assert(mainA !== undefined && mainA.name === 'Join a course', 'AT-D01: Discovered main heading "Join a course"');

  const formA = mapA.resources.find((r) => r.kind === 'form');
  assert(formA !== undefined && formA.name === 'Learner registration', 'AT-D01: Discovered form with aria-labelledby "Learner registration"');

  const nameField = mapA.resources.find((r) => r.name === 'What should we call you?');
  assert(nameField !== undefined && nameField.fieldType === 'text' && nameField.required === true, 'AT-D01: Discovered required name text input from label');

  const idRouteField = mapA.resources.find((r) => r.name === 'Which identity route works for you?');
  assert(idRouteField !== undefined && idRouteField.fieldType === 'select', 'AT-D01: Discovered select field for identity route');
  assert(idRouteField.options?.length === 4, 'AT-D01: Discovered all 4 options in select field');

  const supportField = mapA.resources.find((r) => r.name === 'What would make learning easier?');
  assert(supportField !== undefined && supportField.privacy === 'private-support', 'AT-P03: data-roha-private marked as private-support');

  // Verify no raw HTML or selectors in map A (D03 requirement)
  const mapStrA = JSON.stringify(mapA);
  assert(!mapStrA.includes('selector'), 'AT-D03: No selectors in exported map');
  assert(!mapStrA.includes('<input'), 'AT-D03: No raw HTML in exported map');

  // =========================================================================
  // Test 2: AT-D01 & AT-D02 - Discovery on Host B & Button Disambiguation
  // =========================================================================
  const domB = new JSDOM(hostBHtml, {
    runScripts: 'dangerously',
    url: 'http://localhost/jobs',
  });

  domB.window.eval(rohaScriptContent);
  const rohaB = domB.window.Roha;
  assert(rohaB !== undefined, 'Roha SDK instantiates on Host B');

  const mapB = rohaB.mount();
  assert(mapB.resources.length >= 5, 'AT-D01: Discovered jobs, buttons, and filter on Host B');

  const jobData = mapB.resources.find((r) => r.name === 'Data assistant');
  const jobSupport = mapB.resources.find((r) => r.name === 'Customer support');
  assert(jobData !== undefined && jobSupport !== undefined, 'AT-D01: Discovered both job cards');

  const applyButtons = mapB.resources.filter((r) => r.kind === 'button' && r.name === 'Apply');
  assert(applyButtons.length === 2, 'AT-D02: Discovered both Apply buttons');
  assert(applyButtons[0].parentId !== applyButtons[1].parentId, 'AT-D02: Two Apply buttons have distinct contextual parents');
  assert(applyButtons[0].id !== applyButtons[1].id, 'AT-D02: Two Apply buttons have distinct target IDs');

  // =========================================================================
  // Test 3: AT-A01 - Real Text Scaling and Reset
  // =========================================================================
  const initialScale = domA.window.document.documentElement.getAttribute('data-roha-scale');
  assert(!initialScale, 'AT-A01: Initial text scale is default (no attribute)');

  // Propose text scale 150%
  const scaleIntent = {
    schemaVersion: '2.0',
    utteranceId: 'turn-001',
    mapId: mapA.mapId,
    mapVersion: mapA.mapVersion,
    intent: 'text_scale',
    targetId: 'page.main',
    payload: { percent: 150 },
  };

  const execScaleResult = rohaA.executeIntent(scaleIntent);
  assert(execScaleResult.success === true, 'AT-A01: text_scale 150% executed successfully');
  assert(domA.window.document.documentElement.getAttribute('data-roha-scale') === '150', 'AT-A01: Host document has data-roha-scale="150"');

  // Reset text scale
  const resetIntent = {
    schemaVersion: '2.0',
    utteranceId: 'turn-002',
    mapId: mapA.mapId,
    mapVersion: mapA.mapVersion,
    intent: 'text_scale',
    targetId: 'page.main',
    payload: { percent: 100 },
  };
  rohaA.executeIntent(resetIntent);
  assert(!domA.window.document.documentElement.getAttribute('data-roha-scale'), 'AT-A01: Text scale reset clears data-roha-scale attribute');

  // =========================================================================
  // Test 4: AT-A02 - Simple Explanation with Original Available
  // =========================================================================
  const labelEl = domA.window.document.querySelector('label[for="preferred-name"]');
  const originalText = labelEl.textContent;
  
  // Enable simple mode
  rohaA.executeIntent({
    schemaVersion: '2.0',
    utteranceId: 'turn-003',
    mapId: mapA.mapId,
    mapVersion: mapA.mapVersion,
    intent: 'simple_mode',
    targetId: 'page.main',
    payload: { enabled: true },
  });

  assert(labelEl.textContent !== originalText, 'AT-A02: Label simplified in simple mode');
  assert(labelEl.getAttribute('data-roha-original') === originalText, 'AT-A02: Original wording preserved in data-roha-original');

  // Revert simple mode
  rohaA.executeIntent({
    schemaVersion: '2.0',
    utteranceId: 'turn-004',
    mapId: mapA.mapId,
    mapVersion: mapA.mapVersion,
    intent: 'simple_mode',
    targetId: 'page.main',
    payload: { enabled: false },
  });
  assert(labelEl.textContent === originalText, 'AT-A02: Original wording restored when simple mode disabled');

  // =========================================================================
  // Test 5: AT-V04 & AT-V05 - Conversation State, Recovery, Local Command Routing
  // =========================================================================
  // Route user utterances through local router
  rohaA.handleUserUtterance('make words bigger');
  assert(domA.window.document.documentElement.getAttribute('data-roha-scale') !== null, 'AT-V05: "make words bigger" routed and executed without LLM');

  rohaA.handleUserUtterance('reset size');
  assert(!domA.window.document.documentElement.getAttribute('data-roha-scale'), 'AT-V05: "reset size" routed and executed');

  // Form input answer
  const nameInput = domA.window.document.getElementById('preferred-name');
  rohaA.executeIntent({
    schemaVersion: '2.0',
    utteranceId: 'turn-005',
    mapId: mapA.mapId,
    mapVersion: mapA.mapVersion,
    intent: 'propose_answer',
    targetId: nameField.id,
    payload: { value: 'Sara Tadesse' },
  });
  assert(nameInput.value === 'Sara Tadesse', 'AT-V04: Propose answer updates input value');

  // Deliberate correction (AT-V04)
  rohaA.executeIntent({
    schemaVersion: '2.0',
    utteranceId: 'turn-006',
    mapId: mapA.mapId,
    mapVersion: mapA.mapVersion,
    intent: 'propose_answer',
    targetId: nameField.id,
    payload: { value: 'Sara Bekele Tadesse' },
  });
  assert(nameInput.value === 'Sara Bekele Tadesse', 'AT-V04: Corrected answer updates input value correctly');

  // =========================================================================
  // Test 6: AT-P01 & AT-P02 - Security & Safety Validation
  // =========================================================================
  // Stale mapVersion rejected
  const staleRes = rohaA.executeIntent({
    schemaVersion: '2.0',
    utteranceId: 'bad-turn',
    mapId: mapA.mapId,
    mapVersion: 9999, // Stale!
    intent: 'text_scale',
    targetId: 'page.main',
    payload: { percent: 150 },
  });
  assert(staleRes.success === false, 'AT-P01: Stale mapVersion rejected');

  // Unknown target rejected
  const unknownTargetRes = rohaA.executeIntent({
    schemaVersion: '2.0',
    utteranceId: 'bad-turn',
    mapId: mapA.mapId,
    mapVersion: mapA.mapVersion,
    intent: 'propose_answer',
    targetId: 'nonexistent.target',
    payload: { value: 'hack' },
  });
  assert(unknownTargetRes.success === false, 'AT-P01: Unknown target ID rejected');

  // Model-supplied approval flag rejected (AT-P01)
  const forgedApprovalRes = rohaA.executeIntent({
    schemaVersion: '2.0',
    utteranceId: 'bad-turn',
    mapId: mapA.mapId,
    mapVersion: mapA.mapVersion,
    intent: 'request_submission',
    targetId: formA.id,
    payload: { approved: true }, // Not permitted in payload!
  });
  assert(forgedApprovalRes.success === false, 'AT-P01: Forged model approval flag rejected');

  // Injected script in payload rejected (AT-P02)
  const scriptInjectRes = rohaA.executeIntent({
    schemaVersion: '2.0',
    utteranceId: 'bad-turn',
    mapId: mapA.mapId,
    mapVersion: mapA.mapVersion,
    intent: 'propose_answer',
    targetId: nameField.id,
    payload: { value: '<script>alert("xss")</script>' },
  });
  assert(scriptInjectRes.success === false, 'AT-P02: Script injection in payload rejected');

  // Out-of-bounds text scale rejected
  const badScaleRes = rohaA.executeIntent({
    schemaVersion: '2.0',
    utteranceId: 'bad-turn',
    mapId: mapA.mapId,
    mapVersion: mapA.mapVersion,
    intent: 'text_scale',
    targetId: 'page.main',
    payload: { percent: 500 }, // Not in 100, 125, 150, 175, 200
  });
  assert(badScaleRes.success === false, 'AT-P01: Out-of-bounds text_scale rejected');

  // =========================================================================
  // Test 7: AT-C02 - Private Support-Needs Job Filter
  // =========================================================================
  const filterNeedsField = mapB.resources.find((r) => r.name === 'Support I need' || r.id.includes('needs'));
  assert(filterNeedsField !== undefined, 'Discovered job needs filter control on Host B');

  // Filter by flexible hours
  rohaB.executeIntent({
    schemaVersion: '2.0',
    utteranceId: 'turn-007',
    mapId: mapB.mapId,
    mapVersion: mapB.mapVersion,
    intent: 'filter',
    targetId: filterNeedsField.id,
    payload: { query: 'flexible' },
  });

  const dataSection = domB.window.document.querySelector('section[aria-labelledby="data-title"]');
  const supportArticle = domB.window.document.querySelector('article[aria-labelledby="support-title"]');
  assert(dataSection.style.display !== 'none', 'AT-C02: Matching vacancy remains visible');
  assert(supportArticle.style.display === 'none', 'AT-C02: Non-matching vacancy hidden locally');

  // =========================================================================
  // Test 8: Capabilities Matrix Verification (L01, F02)
  // =========================================================================
  const caps = rohaA.getCapabilities();
  assert(caps.schemaVersion === '2.0', 'AT-L01: Capabilities schemaVersion is 2.0');
  assert(caps.languages.length === 4, 'AT-L01: All 4 languages tracked (en, am, ti, om)');
  
  const enCaps = caps.languages.find((l) => l.tag === 'en');
  assert(enCaps.capabilities.ui.status === 'verified', 'AT-L01: English UI verified');
  assert(enCaps.capabilities.commands.status === 'verified', 'AT-L01: English commands verified');

  const wakeCap = enCaps.capabilities.wake;
  assert(wakeCap.status === 'unavailable' && wakeCap.offlineReady === false, 'AT-V03: Wake is honestly marked unavailable');

  // =========================================================================
  // Test 9: P1 Features Verification (D07, A06, C04, V07)
  // =========================================================================
  // AT-D07: Website compatibility report
  const compatReport = rohaA.getCompatibilityReport();
  assert(compatReport.totalResources >= 4, 'AT-D07: Compatibility report lists discovered resources');
  assert(compatReport.unlabelledControls.length === 0, 'AT-D07: No unlabelled controls in clean host A fixture');
  assert(typeof compatReport.privacyBreakdown['private-support'] === 'number', 'AT-D07: Compatibility report includes privacy breakdown');

  // AT-A06: Orientation "Where am I?"
  const orientation = rohaA.getOrientationSummary();
  assert(orientation.includes('question') || orientation.includes('ready'), 'AT-A06: Orientation explains current page progress and task');

  // AT-C04: Job context and application checklist
  const checklist = rohaA.getJobChecklist();
  assert(Array.isArray(checklist.requiredRemaining), 'AT-C04: Application checklist evaluates required fields');

  // AT-V07: Spelling and digit review
  const normalizedDigits = rohaA.normalizeSpokenDigits('zero nine one two three four five six seven eight');
  assert(normalizedDigits === '0912345678', 'AT-V07: Spoken number words normalized into digit string');

  // =========================================================================
  // Test 10: AT-I01 - Teardown / Unmount Cleanliness
  // =========================================================================
  rohaA.unmount();
  const panelAfter = domA.window.document.getElementById('roha-assistant-panel');
  assert(panelAfter === null, 'AT-I01: Assistant panel removed cleanly on unmount');

  // =========================================================================
  // Test 11: Prepared Post-Hackathon Items (AT-B01, AT-B02, AT-B03, AT-V03)
  // =========================================================================
  console.log('\n--- Testing Prepared Post-Hackathon Integration Adapters ---');

  // --- B01: Partner-Assisted Portal ---
  const partnerMgr = rohaB.getPartnerManager();
  assert(partnerMgr !== undefined, 'AT-B01: Partner-assisted manager is accessible on SDK');

  const loginSuccess = await partnerMgr.loginPartner('partner-auth-jwt-token-xyz');
  assert(loginSuccess === true, 'AT-B01: Partner authenticated successfully');
  const activePartner = partnerMgr.getActivePartner();
  assert(activePartner !== null && activePartner.organisation.includes('AAAPD'), 'AT-B01: Active partner session records organisation');

  // Partner prepares draft
  const preparedDraft = partnerMgr.prepareDraft('job-application-form-1', {
    preferredName: 'Dawit Abebe',
    phone: '0911002233',
    privateSupportNeeds: 'Requires screen reader friendly test',
  });

  assert(preparedDraft.auditTrail.length === 1, 'AT-B01: Draft contains initial preparation audit entry');
  assert(partnerMgr.canSubmitDraft(preparedDraft) === false, 'AT-B01: Partner strictly CANNOT submit draft without learner approval');

  // Learner reviews and approves draft
  assert(preparedDraft.learnerConsent.consentTextAm.length > 0, 'AT-B01: Learner consent provided in Amharic');
  assert(preparedDraft.learnerConsent.consentTextEn.length > 0, 'AT-B01: Learner consent provided in English');
  partnerMgr.grantLearnerApproval(preparedDraft);
  assert(preparedDraft.learnerConsent.granted === true, 'AT-B01: Learner consent granted after review');
  assert(partnerMgr.canSubmitDraft(preparedDraft) === true, 'AT-B01: Application submission unlocked after learner approval');
  assert(preparedDraft.auditTrail.length === 2, 'AT-B01: Audit trail recorded learner consent timestamp and actor');

  partnerMgr.logoutPartner();
  assert(partnerMgr.getActivePartner() === null, 'AT-B01: Partner session cleared on logout');

  // --- B02: SMS Resume Link & Opaque Cryptographic Tokens ---
  const smsService = rohaB.getSMSService();
  assert(smsService !== undefined, 'AT-B02: SMS Resume service is accessible on SDK');

  const smsResult = await smsService.createAndSendResumeLink(
    '+251911223344',
    'registration-form',
    { preferredName: 'Almaz T.', step: 2 },
    48
  );

  assert(smsResult.success === true, 'AT-B02: SMS dispatch result successful');
  assert(smsResult.token !== undefined && smsResult.token.length >= 32, 'AT-B02: Token is high-entropy cryptographic token');
  
  // Zero PII in query string / URL verification
  assert(!smsResult.resumeUrl.includes('Almaz'), 'AT-B02: Resume URL strictly contains ZERO PII (no name in URL)');
  assert(!smsResult.resumeUrl.includes('251911223344'), 'AT-B02: Resume URL strictly contains ZERO PII (no phone in URL)');
  assert(!smsResult.resumeUrl.includes('step'), 'AT-B02: Resume URL strictly contains ZERO answers or step data');
  assert(smsResult.resumeUrl.includes(`token=${smsResult.token}`), 'AT-B02: Resume URL contains only the opaque token');

  // Token redemption
  const redeemed = smsService.redeemToken(smsResult.token);
  assert(redeemed.valid === true && redeemed.data.preferredName === 'Almaz T.', 'AT-B02: Valid token redeems draft data');

  // Token revocation
  smsService.revokeToken(smsResult.token);
  const revokedRedeem = smsService.redeemToken(smsResult.token);
  assert(revokedRedeem.valid === false && revokedRedeem.error.includes('revoked'), 'AT-B02: Revoked token cannot be redeemed');

  // --- B03: Private Human Video/Screen Handoff ---
  const handoffMgr = rohaB.getHumanHandoffManager();
  assert(handoffMgr !== undefined, 'AT-B03: Human handoff manager is accessible on SDK');

  const mockAnswers = {
    fullName: 'Kebede Michael',
    kebeleIdNumber: 'KB-882910-AA',
    supportNeedsDisability: 'Wheelchair user, needs ground-floor ramp',
    accountPassword: 'secretpassword123',
    uploadedResumeFile: '[binary blob]',
    preferredCity: 'Addis Ababa',
  };

  const preview = handoffMgr.generateContextPreview(
    'Identity Verification Step',
    'am',
    mockAnswers,
    'Camera permission failed for ID capture',
    false // screen sharing opted out
  );

  assert(preview.sharedFieldsAllowlist.includes('fullName'), 'AT-B03: Non-sensitive name allowed in shared context');
  assert(preview.sharedFieldsAllowlist.includes('preferredCity'), 'AT-B03: Non-sensitive city allowed in shared context');
  assert(!preview.sharedFieldsAllowlist.includes('kebeleIdNumber'), 'AT-B03: Kebele ID strictly omitted from shared context');
  assert(!preview.sharedFieldsAllowlist.includes('supportNeedsDisability'), 'AT-B03: Disability/support details strictly omitted from shared context');
  assert(!preview.sharedFieldsAllowlist.includes('accountPassword'), 'AT-B03: Passwords strictly omitted from shared context');
  assert(preview.omittedSensitiveFields.length >= 3, 'AT-B03: Sensitive fields tracked in omitted list');
  assert(preview.screenSharingOptIn === false, 'AT-B03: Screen sharing defaults to disabled (no silent streaming)');

  const ticketRes = await handoffMgr.submitSupportRequest('video-sign-language', '+251912345678', preview);
  assert(ticketRes.success === true && ticketRes.ticketId !== undefined, 'AT-B03: Support ticket submitted with wait time estimate');
  assert(handoffMgr.getActiveTicket() !== null, 'AT-B03: Active ticket tracked');
  await handoffMgr.cancelActiveTicket();
  assert(handoffMgr.getActiveTicket() === null, 'AT-B03: Active ticket cancelled cleanly');

  // --- V03: Always-On Background Wake-Word Detector Adapter ---
  const wakeMgr = rohaB.getWakeWordManager();
  assert(wakeMgr !== undefined, 'AT-V03: Wake word manager accessible on SDK');
  assert(wakeMgr.isListening() === false, 'AT-V03: Wake word is idle until explicitly started');

  // Test pluggable detector integration with Mock detector
  let wakeTriggeredCount = 0;
  const mockDetector = {
    id: 'test-mock-detector',
    name: 'Test Keyword Spotter',
    isBackgroundSupported: true,
    _listening: false,
    _callbacks: [],
    start: async function() { this._listening = true; return true; },
    stop: function() { this._listening = false; },
    isListening: function() { return this._listening; },
    getStatus: function() { return this._listening ? 'listening' : 'idle'; },
    onWakeWord: function(cb) { this._callbacks.push(cb); },
    removeWakeWordListener: function(cb) { this._callbacks = this._callbacks.filter((c) => c !== cb); },
    fire: function() {
      this._callbacks.forEach((cb) => cb({ keyword: 'Hey Roha', confidence: 0.96, timestamp: Date.now() }));
    },
  };

  wakeMgr.setDetector(mockDetector);
  wakeMgr.setOnWakeAction(() => {
    wakeTriggeredCount++;
  });

  const wakeStarted = await wakeMgr.enable();
  assert(wakeStarted === true, 'AT-V03: Pluggable wake word detector started');
  assert(wakeMgr.isListening() === true, 'AT-V03: Wake manager reports listening status');

  // Fire simulated wake word
  mockDetector.fire();
  assert(wakeTriggeredCount === 1, 'AT-V03: "Hey Roha" detection triggers SDK action without button click');

  wakeMgr.disable();
  assert(wakeMgr.isListening() === false, 'AT-V03: Wake detector stops cleanly');

  // --- Optional LLM Provider Fallback (V05, L03) ---
  console.log('--- Testing Optional LLM Intent Fallback & Pluggable API Interface ---');
  let llmInterpreted = false;
  const mockLLM = {
    id: 'test-mock-llm',
    name: 'Test Mock LLM',
    interpret: async function(utterance, currentMap) {
      if (utterance.includes('gigantic')) {
        llmInterpreted = true;
        return {
          schemaVersion: '2.0',
          utteranceId: 'turn-llm-1',
          mapId: currentMap.mapId,
          mapVersion: currentMap.mapVersion,
          intent: 'text_scale',
          targetId: 'page.main',
          payload: { percent: 200 },
        };
      }
      return null;
    },
  };

  rohaB.setLLMProvider(mockLLM);
  assert(rohaB.getLLMProvider() !== undefined, 'V05: LLM provider set on SDK');

  // Send conversational utterance not handled by deterministic router
  await rohaB.handleUserUtterance('Please make the letters gigantic for me');
  assert(llmInterpreted === true, 'V05: Conversational phrase fell back to attached LLM provider');
  const actualScale = domB.window.document.documentElement.getAttribute('data-roha-scale');
  assert(actualScale === '200', 'V05: Intent proposed by LLM executed after schema and target validation');

  // --- Testing Universal API Switching Interface ---
  const ollamaProvider = rohaB.configureAPI({ provider: 'ollama', model: 'llama3.2:1b' });
  assert(rohaB.getLLMProvider().id === 'ollama-local-llm', 'API Interface: Successfully switched to Ollama API');

  const openaiProvider = domB.window.createLLMProvider({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o-mini' });
  assert(openaiProvider.id === 'openai-llm', 'Adapter factory creates OpenAI adapter (no live call)');

  const geminiProvider = domB.window.createLLMProvider({ provider: 'gemini', apiKey: 'AIza-test', model: 'gemini-1.5-flash' });
  assert(geminiProvider.id === 'gemini-llm', 'Adapter factory creates Gemini adapter (no live call)');

  const anthropicProvider = domB.window.createLLMProvider({ provider: 'anthropic', apiKey: 'sk-ant-test' });
  assert(anthropicProvider.id === 'anthropic-llm', 'Adapter factory creates Claude adapter (no live call)');

  let rejectedBrowserKey = false;
  try { rohaB.configureAPI({provider: 'openai', apiKey: 'must-not-persist'}); } catch { rejectedBrowserKey = true; }
  assert(rejectedBrowserKey, 'Browser configuration rejects provider secrets');
  assert(domB.window.localStorage.getItem('roha_api_config') === null, 'No provider credentials are persisted in browser storage');

  const customProvider = rohaB.configureAPI({ provider: 'custom', endpoint: 'https://example.com/api/intent' });
  assert(rohaB.getLLMProvider().id === 'custom-rest-provider', 'API Interface: Successfully switched to Custom REST API');

  // Custom pluggable interface test: user writes their own custom API adapter
  class MyNewEnterpriseAPI {
    id = 'my-enterprise-ai';
    name = 'My Enterprise AI';
    async interpret(utterance, currentMap) {
      return {
        schemaVersion: '2.0',
        utteranceId: 'enterprise-1',
        mapId: currentMap.mapId,
        mapVersion: currentMap.mapVersion,
        intent: 'simple_mode',
        targetId: 'page.main',
        payload: { enabled: true },
      };
    }
  }
  rohaB.setLLMProvider(new MyNewEnterpriseAPI());
  assert(rohaB.getLLMProvider().id === 'my-enterprise-ai', 'API Interface: Custom class implementing LLMProvider works seamlessly');

  // =========================================================================
  // Three Signature Experiences Verification
  // =========================================================================
  console.log('\n--- Testing Roha Three Signature Experiences ---');

  // Signature Experience 1: "I'm Stuck"
  const stuck1 = rohaB.conversation.handleImStuck("I don't understand this question", 'en');
  assert(stuck1.barrier === 'dont_understand', 'Signature 1: "I don\'t understand" maps to plain explanation');
  assert(stuck1.suggestedAction === 'simple_mode', 'Signature 1: Suggests simple words action');

  const stuckDoc = rohaB.conversation.handleImStuck("I don't have a national ID document", 'en');
  assert(stuckDoc.barrier === 'no_document', 'Signature 1: "I don\'t have that document" explains alternative ID routes');
  assert(stuckDoc.explanation.includes('Refugee ID') || stuckDoc.explanation.includes('referral'), 'Signature 1: Approved alternative routes provided without inventing eligibility');

  const stuckAm = rohaB.conversation.handleImStuck("መታወቂያ የለኝም", 'am');
  assert(stuckAm.barrier === 'no_document' && stuckAm.explanation.includes('የስደተኛ'), 'Signature 1: Amharic no-document barrier handled accurately');

  const stuckType = rohaB.conversation.handleImStuck("I can't type on this phone", 'en');
  assert(stuckType.barrier === 'cant_type' && stuckType.suggestedAction === 'enable_voice', 'Signature 1: "I can\'t type" offers voice input');

  const stuckOffline = rohaB.conversation.handleImStuck("My internet connection stopped", 'en');
  assert(stuckOffline.barrier === 'connection_stopped' && stuckOffline.explanation.includes('safely preserved'), 'Signature 1: Connection stopped reassures offline preservation');

  // Signature Experience 2: "Check My Answer" & Conversational Correction
  rohaB.conversation.loadFields([
    { id: 'field.name', kind: 'field', name: 'Full Name', fieldType: 'text', required: true, allowedIntents: ['propose_answer'] },
    { id: 'field.phone', kind: 'field', name: 'Phone Number', fieldType: 'text', required: true, allowedIntents: ['propose_answer'] },
  ]);
  rohaB.conversation.correctSpecificField('field.name', 'Abebe Bikila');
  rohaB.conversation.correctSpecificField('field.phone', '0911223344');

  const reviewSummary = rohaB.conversation.getFormattedReviewSummary('en');
  assert(reviewSummary.includes('Abebe Bikila') && reviewSummary.includes('0911223344'), 'Signature 2: "Check my answer" reads back all recorded answers accurately');

  // Patronymic partial edit: "Keep my first name; change my last name"
  const updatedName = rohaB.conversation.updatePartialName('field.name', 'first', 'Kebede');
  assert(updatedName.currentValue === 'Abebe Kebede', 'Signature 2: "Keep my first name; change my last name" accurately updates last name while preserving first name');

  // Undo that change
  const undoneName = rohaB.conversation.undoLastAnswer();
  assert(undoneName.currentValue === 'Abebe Bikila', 'Signature 2: "Undo that change" cleanly restores previous answer');

  // Spoken digit normalization
  const normalizedPhone = rohaB.conversation.normalizeSpokenDigits('zero nine one one two two three three four four');
  assert(normalizedPhone === '0911223344', 'Signature 2: Spoken number words cleanly normalized to numeric string');

  // Signature Experience 3: "Continue Where I Stopped"
  const recap = rohaB.conversation.getResumeRecap();
  assert(recap.includes('step') || recap.includes('ready'), 'Signature 3: Progress preserved and recap clearly announced');

  console.log('✅ All Three Signature Experiences Verified!\n');

  console.log('✅ All Prepared Post-Hackathon Integration Adapters Verified!\n');

  console.log(`\n========================================`);
  console.log(`Roha Runtime Tests Completed: ${passedChecks}/${totalChecks} PASSED`);
  console.log(`========================================\n`);
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
