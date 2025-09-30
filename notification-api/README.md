# Claude Memory Notification API - Cloudflare Worker

## Overview

This Cloudflare Worker provides the backend API for the static GitHub Pages portfolio site at `pranavjagadish.com`. It handles notification routing to Slack and iPhone (via Pushover).

## Architecture

```
Static Site (GitHub Pages)
pranavjagadish.com
    ↓
[api.js - JavaScript Client]
    ↓
Cloudflare Worker
pranavjagadish.com/api/*
    ↓
[Parallel Requests]
    ↓                    ↓
Pushover API      Slack API
    ↓                    ↓
iPhone 14 Pro    Slack Channel
```

## Quick Deploy

### Prerequisites

1. **Cloudflare Account** - Sign up at https://cloudflare.com
2. **Domain on Cloudflare** - Add `pranavjagadish.com` to Cloudflare
3. **Wrangler CLI** - Install: `npm install -g wrangler`

### Step 1: Login to Cloudflare

```bash
wrangler login
```

### Step 2: Create KV Namespaces

```bash
# Create production namespaces
wrangler kv:namespace create "DEVICES"
wrangler kv:namespace create "NOTIFICATIONS"

# Create preview namespaces (for testing)
wrangler kv:namespace create "DEVICES" --preview
wrangler kv:namespace create "NOTIFICATIONS" --preview
```

Copy the namespace IDs and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "DEVICES"
id = "abc123..."  # Replace with actual ID

[[kv_namespaces]]
binding = "NOTIFICATIONS"
id = "def456..."  # Replace with actual ID
```

### Step 3: Set Secrets

```bash
# Pushover credentials
wrangler secret put PUSHOVER_APP_TOKEN
# Enter: your_pushover_app_token

wrangler secret put PUSHOVER_USER_KEY
# Enter: your_pushover_user_key

# Slack credentials
wrangler secret put SLACK_BOT_TOKEN
# Enter: your_slack_bot_token

wrangler secret put SLACK_CHANNEL
# Enter: your_slack_channel_id
```

### Step 4: Deploy

```bash
npm install
wrangler deploy
```

Your API will be live at: `https://claude-memory-notifications.your-subdomain.workers.dev`

### Step 5: Connect Custom Domain

The `wrangler.toml` already has the route configured:

```toml
routes = [
  { pattern = "pranavjagadish.com/api/*", zone_name = "pranavjagadish.com" }
]
```

Just make sure `pranavjagadish.com` is added to your Cloudflare account, then deploy again:

```bash
wrangler deploy
```

Now your API is accessible at: `https://pranavjagadish.com/api/*`

## Testing

### Local Development

```bash
# Start local dev server
wrangler dev

# Test health check
curl http://localhost:8787/api/health

# Test notification
curl -X POST http://localhost:8787/api/notify \
  -H "Content-Type: application/json" \
  -d '{"message":"Test from local dev","priority":1}'
```

### Production Testing

```bash
# Health check
curl https://pranavjagadish.com/api/health

# Status check
curl https://pranavjagadish.com/api/status

# Send notification
curl -X POST https://pranavjagadish.com/api/notify \
  -H "Content-Type: application/json" \
  -d '{
    "message": "🎉 Cloudflare Worker is live!",
    "title": "Production Test",
    "priority": 1,
    "channels": ["iphone", "slack"]
  }'
```

## API Endpoints

### POST /api/notify

Send notification to multiple channels.

**Request:**
```json
{
  "message": "Your notification message",
  "title": "Notification Title (optional)",
  "priority": 0,
  "channels": ["iphone", "slack"]
}
```

**Priority Levels:**
- `-2` = Silent
- `-1` = Quiet
- `0` = Normal (default)
- `1` = High
- `2` = Emergency

**Response:**
```json
{
  "success": true,
  "sent": ["iphone", "slack"],
  "failed": [],
  "timestamp": "2025-10-01T00:00:00Z"
}
```

### GET /api/health

Health check endpoint.

**Response:**
```json
{
  "healthy": true,
  "timestamp": "2025-10-01T00:00:00Z",
  "service": "claude-memory-notifications"
}
```

### GET /api/status

Get API status and channel information.

**Response:**
```json
{
  "status": "operational",
  "version": "1.0.0",
  "channels": {
    "iphone": "operational",
    "slack": "operational"
  },
  "timestamp": "2025-10-01T00:00:00Z"
}
```

### POST /api/devices/register

Register a device for notifications.

**Request:**
```json
{
  "device_id": "device-001",
  "device_name": "My iPhone",
  "device_type": "iphone",
  "push_token": "optional-token"
}
```

### GET /api/devices

List registered devices (placeholder - requires additional implementation).

## Integration with Portfolio

The static site at `pranavjagadish.com` uses `public/api.js` to call this API:

```javascript
// Send notification from frontend
await ClaudeMemoryAPI.sendNotification(
  'Hello from portfolio!',
  'Test',
  1
);
```

## Security

- All secrets stored in Cloudflare (never in code)
- CORS enabled for pranavjagadish.com
- HTTPS enforced
- Rate limiting via Cloudflare
- DDoS protection via Cloudflare

## Monitoring

View logs:
```bash
wrangler tail
```

View metrics in Cloudflare Dashboard:
- Workers → claude-memory-notifications → Metrics

## Cost

**Free Tier:**
- 100,000 requests/day
- Unlimited KV storage (with 1GB limit)
- 10ms CPU time per request

**This is well within free tier limits for personal use.**

## Troubleshooting

### Issue: "No such namespace"

**Solution:** Make sure you've created the KV namespaces and updated `wrangler.toml` with the correct IDs.

### Issue: "Secrets not found"

**Solution:** Set secrets with `wrangler secret put <SECRET_NAME>`

### Issue: "Route not working"

**Solution:** Ensure `pranavjagadish.com` is added to your Cloudflare account and DNS is configured.

## Files

- `worker.js` - Main Cloudflare Worker code
- `wrangler.toml` - Configuration file
- `package.json` - Node.js dependencies
- `README.md` - This file

## Next Steps

1. Deploy Worker: `wrangler deploy`
2. Push portfolio to GitHub Pages
3. Test end-to-end: Static site → Worker → Slack/iPhone
4. Monitor logs and metrics
5. Add rate limiting if needed

## Documentation

See also:
- `../GITHUB_PAGES_SOLUTION.md` - Complete architecture guide
- `../public/api.js` - JavaScript client code
- Cloudflare Workers docs: https://developers.cloudflare.com/workers/
