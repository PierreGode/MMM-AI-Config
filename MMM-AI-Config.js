Module.register("MMM-AI-Config", {
  defaults: {
    openAiApiKey: "",
    showDot: true,
    adminPort: 5006
  },

  start: function() {
    this.status = false;
    if (this.config.openAiApiKey) {
      this.sendSocketNotification("CHECK_KEY", this.config.openAiApiKey);
    }
    this.sendSocketNotification("INIT_SERVER", {
      port: this.config.adminPort,
      openAiApiKey: this.config.openAiApiKey
    });
  },

  socketNotificationReceived: function(notification, payload) {
    if (notification === "DOT_STATUS") {
      this.status = payload === true;
      this.updateDom();
    }
  },

  getDom: function() {
    var wrapper = document.createElement("div");
    if (this.config.showDot) {
      var dot = document.createElement("div");
      dot.className = "dot " + (this.status ? "green" : "red");
      wrapper.appendChild(dot);
    }
    return wrapper;
  },

  getStyles: function() {
    return [this.file("MMM-AI-Config.css")];
  }
});
