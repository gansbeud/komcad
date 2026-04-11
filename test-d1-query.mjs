#!/usr/bin/env node

import { execSync } from 'child_process';

console.log('Testing D1 Query for check_logs...\n');

// Get all check_logs records
const result = execSync('npx wrangler d1 execute komcad --command "SELECT * FROM check_logs ORDER BY created_at DESC LIMIT 10;" --json', {
  cwd: '/workspaces/komcad',
  encoding: 'utf-8'
});

const parsed = JSON.parse(result);
const records = parsed[0].results;

console.log(`✓ Query returned ${records.length} records\n`);

if (records.length > 0) {
  console.log('First record:');
  console.log(JSON.stringify(records[0], null, 2));
  
  // Simulate the TypeScript interface
  const interfaceFields = [
    'id', 'user_id', 'service', 'mode', 'source', 'indicator', 
    'result', 'summary_json', 'is_malicious', 'ip_address', 'created_at'
  ];
  
  console.log('\n✓ Type checking:');
  interfaceFields.forEach(field => {
    const hasField = field in records[0];
    const status = hasField ? '✓' : '✗';
    console.log(`  ${status} ${field}: ${hasField ? records[0][field] : 'MISSING'}`);
  });
} else {
  console.log('✗ No records found - this is the problem!');
  process.exit(1);
}
