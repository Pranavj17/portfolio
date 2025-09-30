/**
 * Claude Memory Notification API - Client-Side JavaScript
 * For Static GitHub Pages Site
 *
 * This calls the Cloudflare Worker API deployed at pranavjagadish.com
 */

const ClaudeMemoryAPI = {
  // Base URL will be your Cloudflare Worker
  baseURL: 'https://pranavjagadish.com/api',

  /**
   * Send notification
   * @param {string} message - Notification message
   * @param {string} title - Notification title
   * @param {number} priority - Priority level (-2 to 2)
   * @param {array} channels - Channels to send to ['iphone', 'slack']
   */
  async sendNotification(message, title = 'Claude Memory', priority = 0, channels = ['iphone', 'slack']) {
    try {
      const response = await fetch(`${this.baseURL}/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          title,
          priority,
          channels
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Notification sent:', data);
        return { success: true, data };
      } else {
        console.error('❌ Notification failed:', data);
        return { success: false, error: data };
      }
    } catch (error) {
      console.error('❌ Notification error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get API status
   */
  async getStatus() {
    try {
      const response = await fetch(`${this.baseURL}/status`);
      return await response.json();
    } catch (error) {
      console.error('❌ Status check failed:', error);
      return { error: error.message };
    }
  },

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      return await response.json();
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return { healthy: false, error: error.message };
    }
  },

  /**
   * Register device
   */
  async registerDevice(deviceId, deviceName, deviceType, pushToken = null) {
    try {
      const response = await fetch(`${this.baseURL}/devices/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_id: deviceId,
          device_name: deviceName,
          device_type: deviceType,
          push_token: pushToken
        })
      });

      return await response.json();
    } catch (error) {
      console.error('❌ Device registration failed:', error);
      return { error: error.message };
    }
  },

  /**
   * Get registered devices
   */
  async getDevices() {
    try {
      const response = await fetch(`${this.baseURL}/devices`);
      return await response.json();
    } catch (error) {
      console.error('❌ Get devices failed:', error);
      return { error: error.message };
    }
  }
};

// Make available globally for console testing
if (typeof window !== 'undefined') {
  window.ClaudeMemoryAPI = ClaudeMemoryAPI;
  console.log('Claude Memory API loaded. Test with: ClaudeMemoryAPI.healthCheck()');
}

// Export for modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ClaudeMemoryAPI;
}
