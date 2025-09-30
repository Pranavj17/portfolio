# 🚀 Quick Start - Deploy in 20 Minutes

## ✅ What You Have

Your portfolio is a **static HTML site** with a **serverless API backend**:

1. **Static Site** → GitHub Pages (`pranavjagadish.com`)
2. **API Backend** → Cloudflare Worker (`pranavjagadish.com/api/*`)

## 📋 Prerequisites

- GitHub account with `Pranavj17/portfolio` repository
- Cloudflare account (free tier)
- `pranavjagadish.com` domain added to Cloudflare
- Wrangler CLI: `npm install -g wrangler`

## 🎯 Deployment Steps

### Step 1: Deploy Cloudflare Worker Backend (10 min)

```bash
cd /Users/pranav/Documents/portfolio/notification-api

# Login to Cloudflare
wrangler login

# Create KV namespaces
wrangler kv:namespace create "DEVICES"
wrangler kv:namespace create "NOTIFICATIONS"

# Copy the IDs from output and update wrangler.toml
# Replace YOUR_DEVICES_KV_NAMESPACE_ID and YOUR_NOTIFICATIONS_KV_NAMESPACE_ID

# Set secrets
wrangler secret put PUSHOVER_APP_TOKEN
# Enter: your_pushover_app_token

wrangler secret put PUSHOVER_USER_KEY
# Enter: your_pushover_user_key

wrangler secret put SLACK_BOT_TOKEN
# Enter: your_slack_bot_token

wrangler secret put SLACK_CHANNEL
# Enter: your_slack_channel_id

# Install dependencies and deploy
npm install
wrangler deploy
```

✅ **Worker is now live at: `pranavjagadish.com/api/*`**

### Step 2: Clean Up Node.js Files (2 min)

GitHub Pages doesn't support Node.js backend, so remove those files:

```bash
cd /Users/pranav/Documents/portfolio

# Remove Node.js backend files (NOT needed for GitHub Pages)
git rm -f server.js
git rm -rf routes/
rm .env.example

# Remove Node.js docs (we have Cloudflare docs instead)
rm DEPLOY_INSTRUCTIONS.md
rm NOTIFICATION_API.md
rm PORTFOLIO_INTEGRATION_COMPLETE.md
```

### Step 3: Push to GitHub Pages (5 min)

```bash
cd /Users/pranav/Documents/portfolio

# Add the static site files
git add public/index.html
git add public/api.js
git add notification-api/
git add GITHUB_PAGES_SOLUTION.md
git add QUICK_START.md

# Commit
git commit -m "Add Claude Memory API integration

- Client-side JavaScript API wrapper (api.js)
- Cloudflare Worker backend (notification-api/)
- Calls pranavjagadish.com/api/* endpoints
- Sends to Slack + iPhone via Pushover
- Complete static site + serverless backend solution"

# Push to GitHub
git push origin main
```

✅ **GitHub Pages will auto-deploy in ~1 minute**

### Step 4: Test Everything (3 min)

```bash
# Test Cloudflare Worker directly
curl https://pranavjagadish.com/api/health

# Send test notification
curl -X POST https://pranavjagadish.com/api/notify \
  -H "Content-Type: application/json" \
  -d '{
    "message": "🎉 API is live!",
    "priority": 1
  }'
```

**Check your iPhone and Slack - you should get notifications!**

Then open `https://pranavjagadish.com` in browser console:

```javascript
// Test from browser
await ClaudeMemoryAPI.healthCheck()

await ClaudeMemoryAPI.sendNotification(
  '🎉 Portfolio + API working!',
  'Success',
  1
)
```

## 🎉 Done!

You now have:

- ✅ Static portfolio on GitHub Pages
- ✅ Serverless API on Cloudflare Workers
- ✅ Notifications to Slack + iPhone
- ✅ Single domain (pranavjagadish.com)
- ✅ Zero monthly cost
- ✅ Auto-deploy on git push

## 📊 Architecture

```
Browser → pranavjagadish.com (GitHub Pages - Static HTML)
    ↓
  api.js (JavaScript Client)
    ↓
pranavjagadish.com/api/* (Cloudflare Worker)
    ↓
[Parallel Requests]
    ↓                    ↓
Pushover API      Slack API
    ↓                    ↓
iPhone 14 Pro    Slack Channel
```

## 🔄 Update Claude Memory to Use Portfolio API

```bash
cd /Users/pranav/Documents/apps/apps/claude_memory

# Enable portfolio API
export USE_PORTFOLIO_API="true"
echo 'export USE_PORTFOLIO_API="true"' >> ~/.claude_zshrc
```

Edit `lib/claude_memory/slack_integration.ex`:

```elixir
@portfolio_api_url "https://pranavjagadish.com/api/notify"
@use_portfolio_api System.get_env("USE_PORTFOLIO_API") == "true"

defp send_http_notification(notification, _webhook_url) do
  if @use_portfolio_api do
    send_via_portfolio_api(notification)
  else
    send_slack_and_pushover(notification)
  end
end

defp send_via_portfolio_api(notification) do
  headers = [{"Content-Type", "application/json"}]

  body = Jason.encode!(%{
    message: notification.text,
    title: "Claude Memory",
    priority: 1,
    channels: ["iphone", "slack"]
  })

  case Finch.build(:post, @portfolio_api_url, headers, body)
       |> Finch.request(ClaudeMemory.Finch) do
    {:ok, %{status: status}} when status in 200..299 ->
      {:ok, :sent}
    {:error, _} ->
      send_slack_and_pushover(notification)
  end
end
```

Recompile:
```bash
mix compile
```

## 📚 Documentation

- `GITHUB_PAGES_SOLUTION.md` - Complete architecture guide
- `notification-api/README.md` - Cloudflare Worker documentation
- `public/api.js` - JavaScript API client

## 🆘 Troubleshooting

**Issue:** Worker deploy fails

**Solution:** Make sure `pranavjagadish.com` is added to your Cloudflare account

**Issue:** KV namespace errors

**Solution:** Create namespaces and update IDs in `wrangler.toml`

**Issue:** GitHub Pages not updating

**Solution:** Check repository Settings → Pages → Source is set to `main` branch

## 💡 What NOT to Deploy

These files are NOT needed for GitHub Pages (already removed in Step 2):

- ❌ `server.js` (Node.js backend - not supported)
- ❌ `routes/` (Express routes - not needed)
- ❌ `.env.example` (backend config - not needed)
- ❌ `package.json` (if it references server - not needed)

## ✅ What TO Deploy

- ✅ `public/` directory (HTML, CSS, JS, assets)
- ✅ `public/api.js` (JavaScript API client)
- ✅ `notification-api/` (Cloudflare Worker code)
- ✅ Documentation files (*.md)

---

**Total Time:** ~20 minutes
**Cost:** $0/month
**Complexity:** Low

🎉 **You're all set!**
