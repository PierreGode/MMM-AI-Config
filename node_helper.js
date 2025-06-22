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

    const loadConfig = () => {
      try {
        delete require.cache[require.resolve(CONFIG_FILE)];
        return require(CONFIG_FILE);
      } catch (e) {
        return null;
      }
    };

    const saveConfig = configObj => {
      try {
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        fs.copyFileSync(CONFIG_FILE, `${CONFIG_FILE}.${ts}`);
        const output =
          "var config = " +
          JSON.stringify(configObj, null, 2) +
          ";\nif (typeof module !== 'undefined') { module.exports = config; }\n";
        fs.writeFileSync(CONFIG_FILE, output);
      } catch (e) {}
    };

    const applyChanges = (configObj, changes) => {
      if (!changes || !Array.isArray(changes.modules)) return;
      changes.modules.forEach(change => {
        const target = configObj.modules.find(m => m.module === change.module);
        if (target && change.config && typeof change.config === "object") {
          Object.assign(target, change.config);
        }
      });
    };

    const computeDiff = (configObj, changes) => {
      const diffs = [];
      if (!changes || !Array.isArray(changes.modules)) return diffs;
      changes.modules.forEach(change => {
        const target = configObj.modules.find(m => m.module === change.module);
        if (target && change.config && typeof change.config === "object") {
          const modDiff = { module: change.module, changes: [] };
          Object.entries(change.config).forEach(([key, val]) => {
            if (target[key] !== val) {
              modDiff.changes.push({ key, before: target[key], after: val });
            }
          });
          if (modDiff.changes.length) diffs.push(modDiff);
        }
      });
      return diffs;
    };

    const parseJsonFromText = text => {
      try {
        return JSON.parse(text);
      } catch (err) {
        const match = text.match(/{[\s\S]*}/);
        if (match) {
          try {
            return JSON.parse(match[0]);
          } catch (e2) {
            console.error("Failed to parse matched JSON", e2);
          }
        }
        throw err;
      }
    };

    const readBody = (req, cb) => {
      let data = "";
      req.on("data", chunk => (data += chunk));
      req.on("end", () => cb(data));
    };

    const sendOpenAIRequest = (prompt, cb) => {
      console.log("Sending prompt to OpenAI:", prompt);
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
          console.log("OpenAI raw response:", data);
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
        console.log("User message:", msg);

        const configObj = loadConfig() || { modules: [] };
        let modules = [];
        try {
          modules = fs.readdirSync(MODULES_DIR);
        } catch (e) {}
        const prompt =
          `Current config: ${JSON.stringify(configObj)}\nModules: ${modules.join(", ")}\n` +
          `User request: ${msg}\n` +
          `Return ONLY JSON in the format {"modules":[{"module":"name","config":{"key":"value"}}]}`;

        sendOpenAIRequest(prompt, (err, answer) => {
          if (err) {
            res.writeHead(500);
            return res.end(JSON.stringify({ error: "OpenAI error" }));
          }
          console.log("AI answer:", answer);
          let changes = null;
          try {
            changes = parseJsonFromText(answer);
          } catch (e) {
            console.error("Failed to parse AI response", answer, e);
          }
          const diff = computeDiff(configObj, changes);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ reply: answer, changes, diff }));
        });
      });
    };

    const handleApply = (req, res) => {
      readBody(req, data => {
        let changes;
        try {
          changes = JSON.parse(data).changes;
        } catch (e) {}
        if (!changes) {
          res.writeHead(400);
          return res.end("Invalid request");
        }
        const configObj = loadConfig() || { modules: [] };
        try {
          applyChanges(configObj, changes);
          saveConfig(configObj);
        } catch (e) {
          res.writeHead(500);
          return res.end(JSON.stringify({ error: "Failed to apply changes" }));
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    };

    this.server = http.createServer((req, res) => {
      if (req.method === "POST" && req.url === "/chat") {
        return handleChat(req, res);
      } else if (req.method === "POST" && req.url === "/apply") {
        return handleApply(req, res);
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
