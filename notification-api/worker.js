/**
 * Cloudflare Worker - Claude Memory Notification API
 * Deployed at: pranavjagadish.com/api/*
 *
 * Handles notification requests from static GitHub Pages site
 * Sends to Pushover (iPhone) and Slack simultaneously
 */

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route handling
    if (url.pathname === '/api/health') {
      return handleHealth(corsHeaders);
    }

    if (url.pathname === '/api/status') {
      return handleStatus(corsHeaders);
    }

    if (url.pathname === '/api/notify') {
      return handleNotify(request, env, corsHeaders);
    }

    if (url.pathname === '/api/devices/register') {
      return handleDeviceRegister(request, env, corsHeaders);
    }

    if (url.pathname === '/api/devices') {
      return handleDevicesList(env, corsHeaders);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};

// Health check endpoint
function handleHealth(corsHeaders) {
  return new Response(JSON.stringify({
    healthy: true,
    timestamp: new Date().toISOString(),
    service: 'claude-memory-notifications'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Status endpoint
function handleStatus(corsHeaders) {
  return new Response(JSON.stringify({
    status: 'operational',
    version: '1.0.0',
    channels: {
      iphone: 'operational',
      slack: 'operational'
    },
    timestamp: new Date().toISOString()
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Main notification endpoint
async function handleNotify(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { message, title = 'Claude Memory', priority = 0, channels = ['iphone', 'slack'] } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results = { sent: [], failed: [], timestamp: new Date().toISOString() };

    // Send to Pushover (iPhone)
    if (!channels || channels.includes('iphone')) {
      try {
        const pushoverResult = await sendToPushover(env, message, title, priority);
        if (pushoverResult.ok) {
          results.sent.push('iphone');
        } else {
          results.failed.push({ channel: 'iphone', error: await pushoverResult.text() });
        }
      } catch (error) {
        results.failed.push({ channel: 'iphone', error: error.message });
      }
    }

    // Send to Slack
    if (!channels || channels.includes('slack')) {
      try {
        const slackResult = await sendToSlack(env, message, title);
        if (slackResult.ok) {
          results.sent.push('slack');
        } else {
          results.failed.push({ channel: 'slack', error: await slackResult.text() });
        }
      } catch (error) {
        results.failed.push({ channel: 'slack', error: error.message });
      }
    }

    return new Response(JSON.stringify({
      success: results.sent.length > 0,
      ...results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Send notification to Pushover (iPhone)
async function sendToPushover(env, message, title, priority) {
  const pushoverUrl = 'https://api.pushover.net/1/messages.json';

  const formData = new FormData();
  formData.append('token', env.PUSHOVER_APP_TOKEN);
  formData.append('user', env.PUSHOVER_USER_KEY);
  formData.append('message', message);
  formData.append('title', title);
  formData.append('priority', priority.toString());

  return fetch(pushoverUrl, {
    method: 'POST',
    body: formData
  });
}

// Send notification to Slack
async function sendToSlack(env, message, title) {
  const slackUrl = 'https://slack.com/api/chat.postMessage';

  return fetch(slackUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.SLACK_BOT_TOKEN}`
    },
    body: JSON.stringify({
      channel: env.SLACK_CHANNEL,
      text: `*${title}*\n${message}`
    })
  });
}

// Device registration (stores in KV)
async function handleDeviceRegister(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { device_id, device_name, device_type, push_token } = body;

    if (!device_id || !device_name || !device_type) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const device = {
      device_id,
      device_name,
      device_type,
      push_token,
      registered_at: new Date().toISOString()
    };

    // Store in KV
    await env.DEVICES.put(device_id, JSON.stringify(device));

    return new Response(JSON.stringify({
      success: true,
      device_id,
      message: 'Device registered successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// List registered devices
async function handleDevicesList(env, corsHeaders) {
  try {
    // KV doesn't support listing all keys easily, so this is a placeholder
    // In production, you'd maintain a separate index
    return new Response(JSON.stringify({
      message: 'Device listing not yet implemented',
      note: 'Use KV namespace list API or maintain separate index'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
