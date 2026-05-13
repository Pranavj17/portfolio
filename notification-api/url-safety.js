/**
 * SSRF protection for outbound Worker fetches.
 *
 * Shared by every internet-tool handler in mcp-worker.js (fetch_url,
 * http_headers, check_url_alive, summarize_url) plus the dns_lookup
 * blocklist check.
 *
 * Threat model:
 *   1. LLM coaxed into fetching internal/private URLs (typical SSRF).
 *   2. DNS rebinding — hostname resolves to public IP at check time,
 *      private IP at fetch time.
 *
 * Mitigations:
 *   - HTTPS-only scheme allowlist.
 *   - Reject literal private IPs in URL.hostname (URL can be a bare IP).
 *   - Reject hostnames in BLOCKED_HOSTNAME_PATTERNS (.internal/.local/
 *     localhost/our own infra).
 *   - DoH-resolve the hostname once (A + AAAA), reject if ANY returned
 *     address is private. A small TOCTOU window remains between this
 *     resolution and the actual fetch; closing it would require IP-pinning
 *     plus a manual Host header, which Workers' fetch doesn't expose
 *     cleanly. Acceptable for a portfolio-demo blast radius.
 *
 * Kept isolated from mcp-worker.js so url-safety tests don't need the
 * full Worker (no JSON imports, no NIM, no KV).
 */

const DOH_URL        = 'https://cloudflare-dns.com/dns-query';
const DOH_TIMEOUT_MS = 3_000;

// IPv4 CIDR ranges that must NEVER be reached by the Worker.
// Pattern → human-readable reason. First match wins.
const IPV4_BLOCK_REASONS = [
    [/^0\./,                                 'unspecified or current-network (0.0.0.0/8)'],
    [/^10\./,                                'private (RFC1918 10.0.0.0/8)'],
    [/^127\./,                               'loopback (127.0.0.0/8)'],
    [/^169\.254\./,                          'link-local (169.254.0.0/16 · incl. AWS/GCP metadata)'],
    [/^172\.(1[6-9]|2\d|3[01])\./,           'private (RFC1918 172.16.0.0/12)'],
    [/^192\.168\./,                          'private (RFC1918 192.168.0.0/16)'],
    [/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, 'CGNAT (RFC6598 100.64.0.0/10)'],
    [/^192\.0\.[02]\./,                      'IETF protocol or TEST-NET-1'],
    [/^198\.(1[89])\./,                      'benchmark (RFC2544 198.18.0.0/15)'],
    [/^198\.51\.100\./,                      'TEST-NET-2'],
    [/^203\.0\.113\./,                       'TEST-NET-3'],
    [/^22[4-9]\./,                           'multicast (224.0.0.0/4)'],
    [/^2[3-5]\d\./,                          'multicast or reserved (240.0.0.0/4)'],
];

// Hostnames that should never be fetched even if DoH happily resolves them.
// Includes well-known internal TLDs, cloud metadata aliases, and our own
// infra (so the LLM can't loop the demo back on itself).
export const BLOCKED_HOSTNAME_PATTERNS = [
    /\.internal$/i,
    /\.local$/i,
    /^localhost$/i,
    /\.localhost$/i,
    /\.onion$/i,
    /^metadata\.google\.internal$/i,
    /^instance-data\.ec2\.internal$/i,
    /^169\.254\.169\.254$/,
    /^pranavjagadish\.com$/i,
    /\.pranavjagadish\.com$/i,
    /\.workers\.dev$/i,
];

function reasonForIpv4(ip) {
    for (const [re, reason] of IPV4_BLOCK_REASONS) {
        if (re.test(ip)) return reason;
    }
    return null;
}

function reasonForIpv6(ip) {
    const lower = ip.toLowerCase().replace(/^\[|\]$/g, '');
    if (lower === '::' || lower === '::1') return 'loopback or unspecified (IPv6)';
    if (/^fc|^fd/.test(lower))     return 'unique local IPv6 (ULA fc00::/7)';
    if (/^fe[89ab]/.test(lower))   return 'link-local IPv6 (fe80::/10)';
    if (/^ff/.test(lower))         return 'multicast IPv6 (ff00::/8)';
    // IPv4-mapped IPv6 (::ffff:a.b.c.d). Extract and re-check.
    const v4Match = lower.match(/(?:^|:)ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (v4Match) return reasonForIpv4(v4Match[1]);
    // 6to4 (2002::/16) — embeds an IPv4 address in bits 16..47. The simplest
    // safe stance is to reject the whole /16; it's a deprecated transition tech
    // and abuse would let an attacker tunnel to private v4 space.
    if (/^2002:/.test(lower)) return '6to4 IPv6 (2002::/16 · deprecated, blocked)';
    // NAT64 well-known prefix (64:ff9b::/96) — translates IPv6 to public IPv4.
    // Block it because we can't validate the embedded v4 without parsing the
    // last 32 bits, and we'd rather lose this transition path than risk SSRF.
    if (/^64:ff9b:/.test(lower)) return 'NAT64 well-known prefix (64:ff9b::/96 · blocked)';
    return null;
}

/**
 * Returns a short reason string if the IP is private/blocked, or null
 * if the IP is a normal public address. Handles both IPv4 dotted-decimal
 * and IPv6 (compressed or expanded, with or without brackets).
 */
export function isPrivateIp(ip) {
    if (!ip) return null;
    const s = String(ip).trim().replace(/^\[|\]$/g, '');
    if (s.includes(':')) return reasonForIpv6(s);
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return reasonForIpv4(s);
    return null;
}

/**
 * Returns a short reason string if the hostname matches a known blocklist
 * pattern (internal TLDs, cloud metadata aliases, our own infra), or null
 * if it's allowed. Does NOT do DNS resolution.
 */
export function isBlockedHostname(hostname) {
    if (!hostname) return null;
    const h = String(hostname).trim();
    for (const re of BLOCKED_HOSTNAME_PATTERNS) {
        if (re.test(h)) return `hostname matches blocked pattern (${re})`;
    }
    return null;
}

/**
 * Cloudflare DNS-over-HTTPS query. Returns raw Answer array (possibly empty)
 * or throws on transport/protocol error.
 *
 * Exported because dns_lookup uses this directly (it's a tool, not just
 * an internal check).
 */
export async function dohResolve(hostname, type = 'A') {
    const url = new URL(DOH_URL);
    url.searchParams.set('name', hostname);
    url.searchParams.set('type', type);
    const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/dns-json' },
        signal: AbortSignal.timeout(DOH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`DoH HTTP ${res.status}`);
    const data = await res.json();
    if (typeof data?.Status !== 'number') throw new Error('DoH returned malformed JSON');
    if (data.Status !== 0) throw new Error(`DoH status ${data.Status}`);
    return Array.isArray(data.Answer) ? data.Answer : [];
}

/**
 * Validate that `rawUrl` is safe to fetch. Returns the parsed URL object
 * on success; throws an Error with "SSRF_BLOCKED: <reason>" message on
 * failure. Every internet-tool handler MUST call this before any outbound
 * fetch.
 */
export async function assertSafePublicUrl(rawUrl) {
    let parsed;
    try { parsed = new URL(String(rawUrl)); }
    catch { throw new Error('SSRF_BLOCKED: invalid URL'); }

    if (parsed.protocol !== 'https:') {
        throw new Error(`SSRF_BLOCKED: only https:// allowed (got ${parsed.protocol})`);
    }

    const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

    // Literal-IP check (URL.hostname can be a bare IP).
    const literalReason = isPrivateIp(hostname);
    if (literalReason) {
        throw new Error(`SSRF_BLOCKED: ${literalReason} · ${hostname}`);
    }

    // Hostname-pattern check.
    const hostBlock = isBlockedHostname(hostname);
    if (hostBlock) {
        throw new Error(`SSRF_BLOCKED: ${hostBlock}`);
    }

    // DoH-resolve A + AAAA. We fail CLOSED on any lookup error — a transient
    // DoH failure for A while AAAA happily returns a public v6 would otherwise
    // approve a hostname whose v4 resolution is unknown (and possibly private).
    const [aRes, aaaaRes] = await Promise.allSettled([
        dohResolve(hostname, 'A'),
        dohResolve(hostname, 'AAAA'),
    ]);
    if (aRes.status === 'rejected' && aaaaRes.status === 'rejected') {
        throw new Error(`SSRF_BLOCKED: DNS lookup failed (${aRes.reason?.message || 'unknown'} · ${aaaaRes.reason?.message || 'unknown'})`);
    }
    if (aRes.status === 'rejected') {
        throw new Error(`SSRF_BLOCKED: A-record lookup failed for ${hostname} (${aRes.reason?.message || 'unknown'})`);
    }
    if (aaaaRes.status === 'rejected') {
        throw new Error(`SSRF_BLOCKED: AAAA-record lookup failed for ${hostname} (${aaaaRes.reason?.message || 'unknown'})`);
    }
    const answers = [...aRes.value, ...aaaaRes.value];

    if (answers.length === 0) {
        throw new Error(`SSRF_BLOCKED: hostname does not resolve (${hostname})`);
    }

    for (const ans of answers) {
        if (!ans?.data) continue;
        const r = isPrivateIp(ans.data);
        if (r) throw new Error(`SSRF_BLOCKED: ${hostname} resolves to ${r} · ${ans.data}`);
    }

    return parsed;
}
