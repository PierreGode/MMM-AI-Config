const NodeHelper = require("node_helper");
const https = require("https");

module.exports = NodeHelper.create({
  start: function() {
    this.status = false;
  },

  socketNotificationReceived: function(notification, payload) {
    if (notification === "CHECK_KEY") {
      this.checkKey(payload);
    }
  },

  checkKey: function(key) {
    if (!key) {
      this.sendSocketNotification("DOT_STATUS", false);
      return;
    }

    const options = {
      hostname: "api.openai.com",
      path: "/v1/models",
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`
      }
    };

    const req = https.request(options, res => {
      this.status = res.statusCode === 200;
      this.sendSocketNotification("DOT_STATUS", this.status);
    });

    req.on("error", err => {
      this.status = false;
      this.sendSocketNotification("DOT_STATUS", false);
    });

    req.end();
  }
});
