const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5006;
const MAGICMIRROR_ROOT = path.join(__dirname, '..', '..');
const CONFIG_FILE = path.join(MAGICMIRROR_ROOT, 'config', 'config.js');
const MODULES_DIR = path.join(MAGICMIRROR_ROOT, 'modules');
const PUBLIC_DIR = path.join(__dirname, 'public');
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

function parseJsonFromText(text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    const match = text.match(/{[\s\S]*}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw err;
  }
}

function loadConfig() {
  try {
    delete require.cache[require.resolve(CONFIG_FILE)];
    return require(CONFIG_FILE);
  } catch (e) {
    return null;
  }
}

function saveConfig(configObj) {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(CONFIG_FILE, `${CONFIG_FILE}.${ts}`);
    const output =
      'var config = ' + JSON.stringify(configObj, null, 2) +
      ';\nif (typeof module !== "undefined") { module.exports = config; }\n';
    fs.writeFileSync(CONFIG_FILE, output);
  } catch (e) {}
}

function applyChanges(configObj, changes) {
  if (!changes || !Array.isArray(changes.modules)) return;
  changes.modules.forEach(change => {
    const target = configObj.modules.find(m => m.module === change.module);
    if (target && change.config && typeof change.config === 'object') {
      Object.assign(target, change.config);
    }
  });
}

function readBody(req, cb) {
  let data = '';
  req.on('data', chunk => data += chunk);
  req.on('end', () => cb(data));
}

function sendOpenAIRequest(prompt, cb) {
  console.log('Sending prompt to OpenAI:', prompt);
  const body = JSON.stringify({
    model: 'gpt-3.5-turbo',
    messages: [{role: 'user', content: prompt}]
  });

  const options = {
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Authorization': `Bearer ${OPENAI_KEY}`
    }
  };

  const req = https.request(options, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('OpenAI raw response:', data);
      try {
        const json = JSON.parse(data);
        const reply = json.choices[0].message.content;
        cb(null, reply);
      } catch (err) {
        cb(err);
      }
    });
  });

  req.on('error', err => cb(err));
  req.write(body);
  req.end();
}

function handleChat(req, res) {
  readBody(req, data => {
    let msg;
    try { msg = JSON.parse(data).message; } catch (e) {}
    if (!msg) {
      res.writeHead(400);
      return res.end('Invalid request');
    }
    console.log('User message:', msg);

    const configObj = loadConfig() || { modules: [] };
    let modules = [];
    try { modules = fs.readdirSync(MODULES_DIR); } catch (e) {}
    const prompt =
      `Current config: ${JSON.stringify(configObj)}\nModules: ${modules.join(', ')}\n` +
      `User request: ${msg}\n` +
      `Return ONLY JSON in the format {"modules":[{"module":"name","config":{"key":"value"}}]}`;

    sendOpenAIRequest(prompt, (err, answer) => {
      if (err) {
        res.writeHead(500);
        return res.end(JSON.stringify({ error: 'OpenAI error' }));
      }
      console.log('AI answer:', answer);
      try {
        const changes = parseJsonFromText(answer);
        applyChanges(configObj, changes);
        saveConfig(configObj);
      } catch (e) {
        console.error('Failed to parse AI response', answer, e);
        res.writeHead(500);
        return res.end(JSON.stringify({ error: 'Invalid AI response' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reply: answer }));
    });
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/chat') {
    return handleChat(req, res);
  }
  // static
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? '/admin.html' : req.url);
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
    } else {
      res.writeHead(200);
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
