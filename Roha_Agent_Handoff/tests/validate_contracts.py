"""Validate handoff contracts. This does NOT test an implemented Roha SDK."""
from pathlib import Path
import copy
import json
from jsonschema import Draft202012Validator, ValidationError

ROOT=Path(__file__).resolve().parents[1]
def load(path):return json.loads((ROOT/path).read_text())
validators={}
for name in ['site-map','intent','capabilities']:
 schema=load('schemas/'+name+'.schema.json');Draft202012Validator.check_schema(schema);validators[name]=Draft202012Validator(schema)

checks=[]
def check(name,fn):
 fn();checks.append(name)
def rejects(validator,value):
 try:validator.validate(value)
 except ValidationError:return
 raise AssertionError('Bad example was accepted')
def check_ref(intent,page):
 validators['intent'].validate(intent)
 if intent['mapId']!=page['mapId'] or intent['mapVersion']!=page['mapVersion']:raise ValueError('Stale/wrong map')
 targets={r['id']:r for r in page['resources']}
 r=targets.get(intent['targetId'])
 if not r or not r['visible'] or not r['enabled']:raise ValueError('Unavailable target')
 if intent['intent'] not in r['allowedIntents']:raise ValueError('Intent not permitted for target')
 # This is a reference-shape check only. Runtime/host authorisation is not implemented here.
def reference_rejects(intent,page):
 try:check_ref(intent,page)
 except (ValueError,ValidationError):return
 raise AssertionError('Bad reference was accepted')

a=load('examples/host-a.map.json');b=load('examples/host-b.map.json');intents=load('examples/intents.json');caps=load('examples/capabilities.json')
check('host A metadata schema',lambda:validators['site-map'].validate(a))
check('host B metadata schema',lambda:validators['site-map'].validate(b))
check('capability schema',lambda:validators['capabilities'].validate(caps))
for i,item in enumerate(intents):check('intent '+str(i+1)+' and current target reference',lambda item=item:check_ref(item,a))

def map_integrity():
 for page in [a,b]:
  ids=[r['id'] for r in page['resources']];assert len(ids)==len(set(ids))
  for r in page['resources']:
   if 'parentId' in r:assert r['parentId'] in ids
check('unique resource IDs and existing parents',map_integrity)
bad=copy.deepcopy(a);bad['resources'][2]['value']='private answer'
check('reject field values in exported metadata',lambda:rejects(validators['site-map'],bad))
bad=copy.deepcopy(a);bad['resources'][0]['selector']='body *'
check('reject executable/locator additions to map',lambda:rejects(validators['site-map'],bad))
bad=copy.deepcopy(intents[0]);bad['payload']['percent']=900
check('reject out-of-range text scaling',lambda:rejects(validators['intent'],bad))
bad=copy.deepcopy(intents[0]);bad['approved']=True
check('reject model-supplied approval flag',lambda:rejects(validators['intent'],bad))
bad=copy.deepcopy(intents[0]);bad['payload']['script']='do something'
check('reject extra executable intent payload',lambda:rejects(validators['intent'],bad))
bad=copy.deepcopy(intents[0]);bad['mapVersion']=999
check('reject stale map reference',lambda:reference_rejects(bad,a))
bad=copy.deepcopy(intents[0]);bad['targetId']='missing.target'
check('reject unknown target reference',lambda:reference_rejects(bad,a))
bad=copy.deepcopy(intents[0]);bad['targetId']='field.name'
check('reject intent not declared for target',lambda:reference_rejects(bad,a))
bad=copy.deepcopy(caps);bad['languages'][0]['capabilities']['wake']['status']='verified'
check('reject verified capability without evidence',lambda:rejects(validators['capabilities'],bad))
bad=copy.deepcopy(caps);bad['languages'][0]['capabilities']['wake']['offlineReady']=True
check('reject unsupported offline-ready assertion',lambda:rejects(validators['capabilities'],bad))

catalog=load('FEATURES.json')['features']
def traceability():
 ids=[f['id'] for f in catalog];assert len(ids)==len(set(ids))
 tests=(ROOT/'ACCEPTANCE_TESTS.md').read_text();status=(ROOT/'STATUS_TEMPLATE.md').read_text();spec=(ROOT/'SPEC.md').read_text()
 for f in catalog:assert f['testId'] in tests and f['id'] in status and f['id'] in spec
check('every feature has spec/test/status traceability',traceability)

def api_contract():
 api=load('openapi.json');assert api['openapi']=='3.1.0'
 assert set(api['paths'])=={'/v1/capabilities','/v1/intent/validate','/v1/transcribe'}
 def refs(value):
  if isinstance(value,dict):
   if '$ref' in value and value['$ref'].startswith('./'):assert (ROOT/value['$ref']).is_file()
   for item in value.values():refs(item)
  elif isinstance(value,list):
   for item in value:refs(item)
 refs(api)
check('proposed API parses and external contract references exist',api_contract)

report='Roha handoff validation\n'+str(len(checks))+' contract/traceability checks passed.\n\n'+'\n'.join('PASS: '+n for n in checks)+'\n\nRuntime SDK, automatic discovery, actual speech/wake, offline caching, host integrations, real device testing and WCAG conformance are NOT verified by this checker.\n'
(ROOT/'CONTRACT_VALIDATION.txt').write_text(report)
print(report)
