const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const MAGICMIRROR_ROOT = path.join(__dirname, '..', '..');
const CONFIG_FILE = path.join(MAGICMIRROR_ROOT, 'config', 'config.js');
const MODULES_DIR = path.join(MAGICMIRROR_ROOT, 'modules');
const PUBLIC_DIR = path.join(__dirname, 'public');
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

function readBody(req, cb) {
  let data = '';
  req.on('data', chunk => data += chunk);
  req.on('end', () => cb(data));
}

function sendOpenAIRequest(prompt, cb) {
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

    let config = '';
    try { config = fs.readFileSync(CONFIG_FILE, 'utf8'); } catch (e) {}
    let modules = [];
    try { modules = fs.readdirSync(MODULES_DIR); } catch (e) {}
    const prompt = `Config:\n${config}\nModules:${modules.join(', ')}\nUser request:${msg}\nReturn updated config.js file only.`;

    sendOpenAIRequest(prompt, (err, answer) => {
      if (err) {
        res.writeHead(500);
        return res.end(JSON.stringify({error:'OpenAI error'}));
      }
      try {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        fs.copyFileSync(CONFIG_FILE, `${CONFIG_FILE}.${ts}`);
        fs.writeFileSync(CONFIG_FILE, answer);
      } catch (e) {}
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({reply: answer}));
    });
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/chat') {
    return handleChat(req, res);
  }
  // static
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? '/web.html' : req.url);
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
