#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dataKey, importExisting, rotateDatabase, rotateFiles, StorageToolError } from './storage-tools.mjs';
try {
  const {values,positionals}=parseArgs({allowPositionals:true,options:{'source-dir':{type:'string'},'output-dir':{type:'string'},apply:{type:'boolean',default:false},offline:{type:'boolean',default:false},help:{type:'boolean',default:false}}});
  if(values.help) {
    console.log('Usage: node storage-cli.mjs import --source-dir DIR [--apply --offline]\n       node storage-cli.mjs rotate [--source-dir DIR --output-dir NEW_DIR] [--apply --offline]\nKeys are environment variables only. Import: DATA_KEY, optional SOURCE_DATA_KEY. Rotate: OLD_DATA_KEY, NEW_DATA_KEY. Database operations require DATABASE_URL. Default is a transactional dry run. Stop all API/maintenance workers before --apply; --offline acknowledges this.');
  }else {
    const [command]=positionals;if(positionals.length!==1 || !['import','rotate'].includes(command))throw new StorageToolError('invalid-command');
    const options={schemaDir:process.env.SCHEMA_DIR || fileURLToPath(new URL('../schema/',import.meta.url)),apply:values.apply,acknowledgeOffline:values.offline,sourceDir:values['source-dir'],outputDir:values['output-dir'],databaseURL:process.env.DATABASE_URL};
    if((command==='import' || !options.sourceDir) && !options.databaseURL)throw new StorageToolError('database-url-required');
    let result;
    if(command==='import') {
      if(!options.sourceDir || options.outputDir)throw new StorageToolError('invalid-import-options');
      result=await importExisting({...options,targetKey:dataKey(process.env.DATA_KEY),sourceKey:process.env.SOURCE_DATA_KEY?dataKey(process.env.SOURCE_DATA_KEY,'source-key'):null});
    }else {
      if(!options.sourceDir && options.outputDir)throw new StorageToolError('invalid-rotation-options');
      const keys={oldKey:dataKey(process.env.OLD_DATA_KEY,'old-key'),newKey:dataKey(process.env.NEW_DATA_KEY,'new-key')};
      result=await(options.sourceDir?rotateFiles:rotateDatabase)({...options,...keys});
    }
    console.log(JSON.stringify(result));
  }
}catch(error){
  // Database/crypto exception messages can contain data. Emit only controlled error codes.
  console.error(JSON.stringify({error:error instanceof StorageToolError?error.code:'operation-failed',...(error instanceof StorageToolError && error.line?{line:error.line}:{})}));process.exitCode=1;
}
