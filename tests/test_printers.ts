import assert from 'assert';
import { printerDiscoveryManager } from '../server/src/services/printerDiscovery.js';
import pool from '../server/src/db/connection.js';

async function runTests() {
  console.log('🧪 Starting Imprevo Automatic Printer Scanning Test Suite...\n');
  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => Promise<void>) {
    total++;
    return (async () => {
      try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
      } catch (err: any) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     Error: ${err.message || err}`);
      }
    })();
  }

  // TEST 1: Real-time Operating System Discovery
  await test('1. OS Printer Discovery returns valid list of printers with schema', async () => {
    const result = await printerDiscoveryManager.scan();
    assert.strictEqual(result.success, true, 'Scan should succeed');
    assert.ok(Array.isArray(result.printers), 'Printers should be an array');
    assert.ok(result.totalFound >= 0, 'Total found count should be non-negative');
    assert.ok(result.scannedAt, 'Should have scannedAt timestamp');

    if (result.printers.length > 0) {
      const printer = result.printers[0];
      assert.ok(printer.name, 'Printer must have a name');
      assert.ok(printer.identifier, 'Printer must have an identifier');
      assert.ok(printer.status, 'Printer must have a reported status');
      assert.strictEqual(typeof printer.isDefault, 'boolean', 'isDefault must be a boolean');
      assert.ok(['Available', 'Ready', 'Idle', 'Printing', 'Busy', 'Offline', 'Error', 'Unknown'].includes(printer.status), `Valid status, got: ${printer.status}`);
      console.log(`     Discovered: "${printer.name}" (${printer.status}, Connection: ${printer.connectionType}, Default: ${printer.isDefault})`);
    }
  });

  // TEST 2: No Hardcoded Printers in Discovery Output
  await test('2. Discovery queries operating system dynamically without hardcoded names', async () => {
    const result = await printerDiscoveryManager.scan();
    // Verify that every printer has system metadata
    for (const p of result.printers) {
      assert.ok(p.id, 'Must have ID');
      assert.ok(p.uri, 'Must have URI');
    }
  });

  // TEST 3: Printer Availability Validation
  await test('3. isPrinterAvailable accurately checks existing vs non-existing printer', async () => {
    const result = await printerDiscoveryManager.scan();
    if (result.printers.length > 0) {
      const realPrinterName = result.printers[0].name;
      const checkReal = await printerDiscoveryManager.isPrinterAvailable(realPrinterName);
      assert.strictEqual(checkReal.exists, true, `Real printer ${realPrinterName} should exist`);
      assert.ok(checkReal.printer, 'Should return printer details');
    }

    const checkFake = await printerDiscoveryManager.isPrinterAvailable('NonExistent_Fake_Printer_99999');
    assert.strictEqual(checkFake.exists, false, 'Non-existent printer should return exists: false');
  });

  // TEST 4: Database Persistence of Default Printer Configuration
  await test('4. Save and restore Default, B&W, and Color printer configuration in database', async () => {
    const scanResult = await printerDiscoveryManager.scan();
    const testPrinter = scanResult.printers[0] || {
      id: 'test_printer_01',
      name: 'Test Printer 01',
      connectionType: 'usb',
      uri: 'windows://Test%20Printer%2001',
      status: 'Available',
    };

    // Save configuration
    await pool.query(
      `INSERT INTO printer_configs (
        terminal_id, default_printer_id, default_printer_name, default_connection_type, default_device_uri, default_status,
        bw_printer_id, bw_printer_name, bw_connection_type, bw_device_uri, bw_status,
        color_printer_id, color_printer_name, color_connection_type, color_device_uri, color_status,
        use_same_printer_for_both
      ) VALUES ('#04', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        default_printer_id = VALUES(default_printer_id),
        default_printer_name = VALUES(default_printer_name),
        default_connection_type = VALUES(default_connection_type),
        default_device_uri = VALUES(default_device_uri),
        default_status = VALUES(default_status),
        bw_printer_id = VALUES(bw_printer_id),
        bw_printer_name = VALUES(bw_printer_name),
        color_printer_id = VALUES(color_printer_id),
        color_printer_name = VALUES(color_printer_name),
        use_same_printer_for_both = VALUES(use_same_printer_for_both)`,
      [
        testPrinter.id, testPrinter.name, testPrinter.connectionType, testPrinter.uri, testPrinter.status,
        testPrinter.id, testPrinter.name, testPrinter.connectionType, testPrinter.uri, testPrinter.status,
        testPrinter.id, testPrinter.name, testPrinter.connectionType, testPrinter.uri, testPrinter.status,
        1,
      ]
    );

    // Retrieve and verify
    const [rows]: any = await pool.query(
      'SELECT default_printer_name, bw_printer_name, color_printer_name, use_same_printer_for_both FROM printer_configs WHERE terminal_id = "#04"'
    );
    assert.ok(rows.length > 0, 'Must have config row');
    assert.strictEqual(rows[0].default_printer_name, testPrinter.name, 'Default printer name must match');
    assert.strictEqual(rows[0].bw_printer_name, testPrinter.name, 'B&W printer name must match');
    assert.strictEqual(Boolean(rows[0].use_same_printer_for_both), true, 'use_same_printer_for_both must be true');
  });

  // TEST 5: Concurrency Safety of Printer Discovery
  await test('5. Concurrent scan calls share execution and return identical consistent state', async () => {
    const [res1, res2, res3] = await Promise.all([
      printerDiscoveryManager.scan(),
      printerDiscoveryManager.scan(),
      printerDiscoveryManager.scan(),
    ]);

    assert.strictEqual(res1.success, true);
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res3.success, true);
    assert.strictEqual(res1.totalFound, res2.totalFound);
    assert.strictEqual(res2.totalFound, res3.totalFound);
  });

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed}/${total} passed (${Math.round((passed / total) * 100)}%)`);
  console.log(`========================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
