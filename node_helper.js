const NodeHelper = require("node_helper");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

module.exports = NodeHelper.create({
  start: function() {
    this.status = false;
    this.server = null;
    this.openAiKey = "";
  },

  socketNotificationReceived: function(notification, payload) {
    if (notification === "CHECK_KEY") {
      this.checkKey(payload);
    } else if (notification === "INIT_SERVER") {
      this.initServer(payload);
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
  },

  initServer: function(config) {
    if (this.server) return;

    const PORT = (config && config.port) || process.env.PORT || 5006;
    this.openAiKey = (config && config.openAiApiKey) || process.env.OPENAI_API_KEY || "";

    const MAGICMIRROR_ROOT = path.join(__dirname, "..", "..");
    const CONFIG_FILE = path.join(MAGICMIRROR_ROOT, "config", "config.js");
    const MODULES_DIR = path.join(MAGICMIRROR_ROOT, "modules");
    const PUBLIC_DIR = path.join(__dirname, "public");

    const readBody = (req, cb) => {
      let data = "";
      req.on("data", chunk => (data += chunk));
      req.on("end", () => cb(data));
    };

    const sendOpenAIRequest = (prompt, cb) => {
      const body = JSON.stringify({
        model: "gpt-4.1-nano",
        messages: [{ role: "user", content: prompt }]
      });

      const options = {
        hostname: "api.openai.com",
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Authorization: `Bearer ${this.openAiKey}`
        }
      };

      const req = https.request(options, res => {
        let data = "";
        res.on("data", chunk => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            const reply = json.choices[0].message.content;
            cb(null, reply);
          } catch (err) {
            cb(err);
          }
        });
      });

      req.on("error", err => cb(err));
      req.write(body);
      req.end();
    };

    const handleChat = (req, res) => {
      readBody(req, data => {
        let msg;
        try {
          msg = JSON.parse(data).message;
        } catch (e) {}
        if (!msg) {
          res.writeHead(400);
          return res.end("Invalid request");
        }

        let configText = "";
        try {
          configText = fs.readFileSync(CONFIG_FILE, "utf8");
        } catch (e) {}
        let modules = [];
        try {
          modules = fs.readdirSync(MODULES_DIR);
        } catch (e) {}
        const prompt = `Config:\n${configText}\nModules:${modules.join(", ")}\nUser request:${msg}\nReturn updated config.js file only, do not alter the config.js in any other way, do not remove code unless asked for. help the user up update the config.js acording to magic mirror standard.`;

        sendOpenAIRequest(prompt, (err, answer) => {
          if (err) {
            res.writeHead(500);
            return res.end(JSON.stringify({ error: "OpenAI error" }));
          }
          try {
            const ts = new Date().toISOString().replace(/[:.]/g, "-");
            fs.copyFileSync(CONFIG_FILE, `${CONFIG_FILE}.${ts}`);
            fs.writeFileSync(CONFIG_FILE, answer);
          } catch (e) {}
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ reply: answer }));
        });
      });
    };

    this.server = http.createServer((req, res) => {
      if (req.method === "POST" && req.url === "/chat") {
        return handleChat(req, res);
      }
      let filePath = path.join(PUBLIC_DIR, req.url === "/" ? "/admin.html" : req.url);
      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(404);
          res.end("Not found");
        } else {
          res.writeHead(200);
          res.end(content);
        }
      });
    });

    this.server.listen(PORT, "0.0.0.0", () => {
      console.log(`MMM-AI-Config admin interface running at http://0.0.0.0:${PORT}`);
    });

    // also check key on startup to update dot
    if (this.openAiKey) {
      this.checkKey(this.openAiKey);
    } else {
      this.sendSocketNotification("DOT_STATUS", false);
    }
  }
});
