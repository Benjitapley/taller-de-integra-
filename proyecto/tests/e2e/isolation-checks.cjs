// No external socket/DNS operation may be invoked by these probes.
const assert = require('node:assert/strict');
require('./network-guard.cjs');
const net = require('node:net');
const dns = require('node:dns');
assert.throws(() => dns.lookup('blocked.invalid', () => {}), /external DNS forbidden/);
(async () => {
  await assert.rejects(new Promise((resolve, reject) => {
    new net.Socket().on('connect', resolve).on('error', reject).connect({ host: '203.0.113.1', port: 443 });
  }), /external socket forbidden/);
  console.log('PASS Next isolation guards: external DNS and sockets blocked');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
