/**
 * --live mode helpers. Fetches:
 *   - latest Medium posts via the public RSS feed
 *   - recent GitHub activity via the unauthenticated events API
 *
 * No deps, no auth, no caching. Each fetch has a 3s timeout and falls
 * back to an empty array on any error so the CLI still prints something
 * useful when the network is flaky.
 */

const MEDIUM_RSS_URL    = 'https://medium.com/feed/@jpranav97';
const GITHUB_EVENTS_URL = 'https://api.github.com/users/Pranavj17/events/public';
const TIMEOUT_MS        = 3_000;

async function safeFetch(url, opts = {}) {
    try {
        const res = await fetch(url, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
            headers: { 'User-Agent': 'pranav-j-cli (https://pranavjagadish.com)' },
            ...opts,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res;
    } catch (e) {
        return null;
    }
}

function decodeXmlEntities(s) {
    return String(s)
        .replace(/&lt;/g,  '<')
        .replace(/&gt;/g,  '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'");
}

function shortDate(iso) {
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().slice(0, 10);
    } catch (_) { return ''; }
}

async function fetchMediumPosts(limit = 5) {
    const res = await safeFetch(MEDIUM_RSS_URL);
    if (!res) return { error: 'medium unreachable', items: [] };
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, limit);
    return {
        items: items.map(([, body]) => {
            const titleMatch = body.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
            const dateMatch  = body.match(/<pubDate>(.*?)<\/pubDate>/);
            const linkMatch  = body.match(/<link>(.*?)<\/link>/);
            return {
                title: decodeXmlEntities(titleMatch?.[1] || 'untitled'),
                date:  shortDate(dateMatch?.[1]),
                url:   linkMatch?.[1] || '',
            };
        }),
    };
}

async function fetchGitHubActivity(limit = 5) {
    const res = await safeFetch(GITHUB_EVENTS_URL);
    if (!res) return { error: 'github unreachable', items: [] };
    let events;
    try { events = await res.json(); }
    catch { return { error: 'github returned non-JSON', items: [] }; }
    if (!Array.isArray(events)) return { error: 'unexpected github response', items: [] };

    const push = events.filter(e => e.type === 'PushEvent').slice(0, limit);
    return {
        items: push.map(e => ({
            repo:    e.repo?.name?.replace(/^Pranavj17\//, '') || '?',
            date:    shortDate(e.created_at),
            message: (e.payload?.commits?.[0]?.message || '').split('\n')[0].slice(0, 70),
        })),
    };
}

module.exports = { fetchMediumPosts, fetchGitHubActivity };
