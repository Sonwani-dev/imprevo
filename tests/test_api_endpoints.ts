import express from 'express';
import printersRouter from '../server/src/routes/printers.js';
import assert from 'assert';
import http from 'http';

async function testApiEndpoints() {
  console.log('🧪 Starting Imprevo Printer API Endpoints HTTP Verification...\n');

  const app = express();
  app.use(express.json());
  app.use('/api/printers', printersRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(5099, resolve));

  const baseUrl = 'http://localhost:5099/api/printers';

  try {
    // 1. Test GET /api/printers/scan
    console.log('1. Testing GET /api/printers/scan...');
    const scanRes = await fetch(`${baseUrl}/scan`);
    assert.strictEqual(scanRes.status, 200, 'GET /scan should return HTTP 200');
    const scanData = await scanRes.json();
    assert.strictEqual(scanData.success, true, 'success should be true');
    assert.ok(Array.isArray(scanData.printers), 'printers must be array');
    assert.ok(scanData.scannedAt, 'must have scannedAt');
    assert.ok(scanData.os, 'must have os');
    console.log(`   ✓ Found ${scanData.printers.length} printer(s) from operating system: ${scanData.printers.map((p: any) => p.name).join(', ')}`);

    // 2. Test GET /api/printers/system (backward compatibility)
    console.log('2. Testing GET /api/printers/system...');
    const sysRes = await fetch(`${baseUrl}/system`);
    assert.strictEqual(sysRes.status, 200);
    const sysData = await sysRes.json();
    assert.strictEqual(sysData.success, true);
    assert.strictEqual(sysData.printers.length, scanData.printers.length);
    console.log(`   ✓ Backward-compatible /system returned ${sysData.printers.length} printer(s)`);

    // 3. Test GET /api/printers/config
    console.log('3. Testing GET /api/printers/config...');
    const cfgRes = await fetch(`${baseUrl}/config?terminalId=%2304`);
    assert.strictEqual(cfgRes.status, 200);
    const cfgData = await cfgRes.json();
    assert.strictEqual(cfgData.success, true);
    assert.ok(cfgData.config, 'Must have config object');
    assert.strictEqual(cfgData.config.terminal_id, '#04');
    console.log(`   ✓ Returned config: default="${cfgData.config.default_printer_name}", bw="${cfgData.config.bw_printer_name}"`);

    // 4. Test POST /api/printers/configure
    console.log('4. Testing POST /api/printers/configure...');
    const saveRes = await fetch(`${baseUrl}/configure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        terminalId: '#04',
        defaultPrinter: {
          id: 'win_Canon_LBP2900',
          name: 'Canon LBP2900',
          connectionType: 'usb',
          uri: 'windows://Canon%20LBP2900',
          status: 'Available',
        },
        bwPrinter: {
          id: 'win_Canon_LBP2900',
          name: 'Canon LBP2900',
          connectionType: 'usb',
          uri: 'windows://Canon%20LBP2900',
          status: 'Available',
        },
        useSameForBoth: true,
      }),
    });
    assert.strictEqual(saveRes.status, 200);
    const saveData = await saveRes.json();
    assert.strictEqual(saveData.success, true);
    console.log(`   ✓ Configure returned: "${saveData.message}"`);

    // 5. Test POST /api/printers/validate
    console.log('5. Testing POST /api/printers/validate...');
    const valRes = await fetch(`${baseUrl}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printerName: 'Canon LBP2900' }),
    });
    assert.strictEqual(valRes.status, 200);
    const valData = await valRes.json();
    assert.strictEqual(valData.success, true);
    console.log(`   ✓ Validate for "Canon LBP2900": exists=${valData.exists}, status=${valData.status}`);

    // 6. Test Security: Reject injection in test-page
    console.log('6. Testing Security: Shell injection rejection in test-page...');
    const injectRes = await fetch(`${baseUrl}/test-page`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printerName: 'Canon LBP2900; calc.exe' }),
    });
    assert.strictEqual(injectRes.status, 400, 'Should reject injection with 400 Bad Request');
    console.log(`   ✓ Injected command safely rejected with HTTP 400`);

    console.log('\n🎉 ALL API ENDPOINTS VERIFIED SUCCESSFULLY!\n');
    process.exit(0);
  } finally {
    server.close();
  }
}

testApiEndpoints().catch((err) => {
  console.error('API Endpoint Test failed:', err);
  process.exit(1);
});
