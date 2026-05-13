/**
 * Offline tests for url-safety.js — the SSRF guard shared by every
 * internet-tool handler in mcp-worker.js.
 *
 * Run:    node test-url-safety.mjs
 * Or:     node --test test-url-safety.mjs   (uses built-in runner output)
 *
 * Tests focus on the security boundary (what gets blocked vs allowed),
 * not the tool handlers themselves (those are smoke-tested live against
 * wrangler dev — see the test plan in the README/spec).
 */

import assert from 'node:assert/strict';
import {
    isPrivateIp,
    isBlockedHostname,
    assertSafePublicUrl,
} from './url-safety.js';

let pass = 0;
let fail = 0;
const failures = [];

function t(name, fn) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
        pass++;
    } catch (e) {
        console.log(`  ✗ ${name}`);
        console.log(`      ${e.message}`);
        failures.push({ name, error: e });
        fail++;
    }
}

async function ta(name, fn) {
    try {
        await fn();
        console.log(`  ✓ ${name}`);
        pass++;
    } catch (e) {
        console.log(`  ✗ ${name}`);
        console.log(`      ${e.message}`);
        failures.push({ name, error: e });
        fail++;
    }
}

// ─── isPrivateIp ────────────────────────────────────────────────────

console.log('\nisPrivateIp · IPv4');
t('10.0.0.1 → blocked (RFC1918)', () => {
    const r = isPrivateIp('10.0.0.1');
    assert.ok(r && /RFC1918/i.test(r), `expected RFC1918, got ${r}`);
});
t('127.0.0.1 → blocked (loopback)', () => {
    const r = isPrivateIp('127.0.0.1');
    assert.ok(r && /loopback/i.test(r), `expected loopback, got ${r}`);
});
t('169.254.169.254 → blocked (AWS metadata · link-local)', () => {
    const r = isPrivateIp('169.254.169.254');
    assert.ok(r && /link-local/i.test(r), `expected link-local, got ${r}`);
});
t('172.16.0.1 → blocked (RFC1918)', () => {
    assert.ok(isPrivateIp('172.16.0.1'));
});
t('172.20.5.5 → blocked (within /12)', () => {
    assert.ok(isPrivateIp('172.20.5.5'));
});
t('172.32.0.1 → allowed (just outside /12)', () => {
    assert.strictEqual(isPrivateIp('172.32.0.1'), null);
});
t('192.168.1.1 → blocked (RFC1918)', () => {
    assert.ok(isPrivateIp('192.168.1.1'));
});
t('100.64.0.1 → blocked (CGNAT)', () => {
    const r = isPrivateIp('100.64.0.1');
    assert.ok(r && /CGNAT/i.test(r), `expected CGNAT, got ${r}`);
});
t('100.128.0.1 → allowed (just outside CGNAT /10)', () => {
    assert.strictEqual(isPrivateIp('100.128.0.1'), null);
});
t('0.0.0.0 → blocked (unspecified)', () => {
    assert.ok(isPrivateIp('0.0.0.0'));
});
t('224.0.0.1 → blocked (multicast)', () => {
    assert.ok(isPrivateIp('224.0.0.1'));
});
t('1.1.1.1 → allowed (Cloudflare public)', () => {
    assert.strictEqual(isPrivateIp('1.1.1.1'), null);
});
t('8.8.8.8 → allowed (Google DNS)', () => {
    assert.strictEqual(isPrivateIp('8.8.8.8'), null);
});
t('93.184.216.34 → allowed (example.com)', () => {
    assert.strictEqual(isPrivateIp('93.184.216.34'), null);
});

console.log('\nisPrivateIp · IPv6');
t('::1 → blocked (loopback)', () => {
    assert.ok(isPrivateIp('::1'));
});
t(':: → blocked (unspecified)', () => {
    assert.ok(isPrivateIp('::'));
});
t('fc00::1 → blocked (ULA)', () => {
    const r = isPrivateIp('fc00::1');
    assert.ok(r && /ULA/i.test(r), `expected ULA, got ${r}`);
});
t('fd12:3456::1 → blocked (ULA)', () => {
    assert.ok(isPrivateIp('fd12:3456::1'));
});
t('fe80::1 → blocked (link-local)', () => {
    const r = isPrivateIp('fe80::1');
    assert.ok(r && /link-local/i.test(r), `expected link-local, got ${r}`);
});
t('ff02::1 → blocked (multicast)', () => {
    assert.ok(isPrivateIp('ff02::1'));
});
t('::ffff:10.0.0.1 → blocked (IPv4-mapped private)', () => {
    assert.ok(isPrivateIp('::ffff:10.0.0.1'));
});
t('2606:4700:4700::1111 → allowed (Cloudflare public)', () => {
    assert.strictEqual(isPrivateIp('2606:4700:4700::1111'), null);
});

// ─── isBlockedHostname ──────────────────────────────────────────────

console.log('\nisBlockedHostname');
t('localhost → blocked', () => {
    assert.ok(isBlockedHostname('localhost'));
});
t('foo.localhost → blocked', () => {
    assert.ok(isBlockedHostname('foo.localhost'));
});
t('foo.internal → blocked', () => {
    assert.ok(isBlockedHostname('foo.internal'));
});
t('foo.local → blocked', () => {
    assert.ok(isBlockedHostname('foo.local'));
});
t('foo.onion → blocked', () => {
    assert.ok(isBlockedHostname('foo.onion'));
});
t('metadata.google.internal → blocked', () => {
    assert.ok(isBlockedHostname('metadata.google.internal'));
});
t('pranavjagadish.com → blocked (self)', () => {
    assert.ok(isBlockedHostname('pranavjagadish.com'));
});
t('api.pranavjagadish.com → blocked (self subdomain)', () => {
    assert.ok(isBlockedHostname('api.pranavjagadish.com'));
});
t('foo.workers.dev → blocked', () => {
    assert.ok(isBlockedHostname('foo.workers.dev'));
});
t('example.com → allowed', () => {
    assert.strictEqual(isBlockedHostname('example.com'), null);
});
t('github.com → allowed', () => {
    assert.strictEqual(isBlockedHostname('github.com'), null);
});

// ─── assertSafePublicUrl ────────────────────────────────────────────

console.log('\nassertSafePublicUrl · scheme & literal-IP checks (no DoH needed)');

await ta('http:// rejected', async () => {
    await assert.rejects(
        () => assertSafePublicUrl('http://example.com'),
        /SSRF_BLOCKED.*https/i,
    );
});
await ta('javascript: rejected', async () => {
    await assert.rejects(
        () => assertSafePublicUrl('javascript:alert(1)'),
        /SSRF_BLOCKED.*https/i,
    );
});
await ta('file:// rejected', async () => {
    await assert.rejects(
        () => assertSafePublicUrl('file:///etc/passwd'),
        /SSRF_BLOCKED.*https/i,
    );
});
await ta('garbage rejected', async () => {
    await assert.rejects(
        () => assertSafePublicUrl('not a url'),
        /SSRF_BLOCKED/i,
    );
});
await ta('literal private IPv4 rejected', async () => {
    await assert.rejects(
        () => assertSafePublicUrl('https://10.0.0.1'),
        /SSRF_BLOCKED.*RFC1918/i,
    );
});
await ta('literal AWS metadata IP rejected', async () => {
    await assert.rejects(
        () => assertSafePublicUrl('https://169.254.169.254/latest/meta-data/'),
        /SSRF_BLOCKED.*link-local/i,
    );
});
await ta('literal IPv6 loopback rejected', async () => {
    await assert.rejects(
        () => assertSafePublicUrl('https://[::1]/admin'),
        /SSRF_BLOCKED/i,
    );
});
await ta('localhost rejected', async () => {
    await assert.rejects(
        () => assertSafePublicUrl('https://localhost:8080'),
        /SSRF_BLOCKED/i,
    );
});
await ta('*.internal rejected', async () => {
    await assert.rejects(
        () => assertSafePublicUrl('https://kube.internal'),
        /SSRF_BLOCKED/i,
    );
});
await ta('our own infra rejected', async () => {
    await assert.rejects(
        () => assertSafePublicUrl('https://pranavjagadish.com/api/mcp/query'),
        /SSRF_BLOCKED/i,
    );
});

// ─── assertSafePublicUrl · DoH-resolved checks (mock fetch) ───────────

console.log('\nassertSafePublicUrl · DoH resolution (mocked)');

const originalFetch = globalThis.fetch;
function stubDoh(answersByHost) {
    globalThis.fetch = async (url) => {
        const u = new URL(url);
        if (u.hostname !== 'cloudflare-dns.com') {
            throw new Error(`unexpected fetch in test: ${url}`);
        }
        const name = u.searchParams.get('name');
        const type = u.searchParams.get('type');
        const key  = `${name}/${type}`;
        const answers = answersByHost[key] ?? answersByHost[name] ?? [];
        return new Response(JSON.stringify({ Status: 0, Answer: answers }), {
            headers: { 'Content-Type': 'application/dns-json' },
        });
    };
}

stubDoh({
    'example.com/A':       [{ data: '93.184.216.34', type: 1, TTL: 86400 }],
    'example.com/AAAA':    [],
    'evil.example.com/A':  [{ data: '10.0.0.5', type: 1, TTL: 60 }],
    'evil.example.com/AAAA': [],
    'metaip.example.com/A':  [{ data: '169.254.169.254', type: 1, TTL: 60 }],
    'metaip.example.com/AAAA': [],
    'nodns.example.com/A':    [],
    'nodns.example.com/AAAA': [],
    'rebind.example.com/A':  [{ data: '8.8.8.8', type: 1, TTL: 60 }],
    'rebind.example.com/AAAA': [{ data: 'fc00::1', type: 28, TTL: 60 }],
});

await ta('public host with public A record → passes', async () => {
    const u = await assertSafePublicUrl('https://example.com/');
    assert.ok(u instanceof URL);
    assert.strictEqual(u.hostname, 'example.com');
});
await ta('public host resolving to RFC1918 → rejected', async () => {
    await assert.rejects(
        () => assertSafePublicUrl('https://evil.example.com'),
        /SSRF_BLOCKED.*resolves to/i,
    );
});
await ta('public host resolving to AWS metadata IP → rejected', async () => {
    await assert.rejects(
        () => assertSafePublicUrl('https://metaip.example.com'),
        /SSRF_BLOCKED.*resolves to/i,
    );
});
await ta('public host with NXDOMAIN-shaped empty resolution → rejected', async () => {
    await assert.rejects(
        () => assertSafePublicUrl('https://nodns.example.com'),
        /SSRF_BLOCKED.*does not resolve/i,
    );
});
await ta('public host with public A but private AAAA → rejected (any private resolution kills it)', async () => {
    await assert.rejects(
        () => assertSafePublicUrl('https://rebind.example.com'),
        /SSRF_BLOCKED.*resolves to/i,
    );
});

globalThis.fetch = originalFetch;

// ─── Summary ─────────────────────────────────────────────────────────

console.log(`\n${pass + fail} tests · ${pass} passed · ${fail} failed`);
if (fail > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
        console.log(`  - ${f.name}: ${f.error.message}`);
    }
    process.exit(1);
}
process.exit(0);
