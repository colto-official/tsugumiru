export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    var body = req.body;
    var apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    var https = require('https');
    var postData = JSON.stringify({
      model: body.model || 'claude-haiku-4-5-20251001',
      max_tokens: body.max_tokens || 4000,
      system: body.system,
      messages: [{ role: 'user', content: body.user }]
    });

    var result = await new Promise(function(resolve, reject) {
      var options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      var req2 = https.request(options, function(response) {
        var data = '';
        response.on('data', function(chunk) { data += chunk; });
        response.on('end', function() {
          try {
            resolve({ statusCode: response.statusCode, body: JSON.parse(data) });
          } catch(e) {
            reject(new Error('Parse error: ' + data));
          }
        });
      });

      req2.on('error', reject);
      req2.write(postData);
      req2.end();
    });

    var rawText = result.body.content[0].text;

    // コードフェンスを除去
    rawText = rawText.replace(/^```json\s*/i, '');
    rawText = rawText.replace(/\s*```\s*$/i, '');
    rawText = rawText.trim();

    // {から}を抽出
    var firstBrace = rawText.indexOf('{');
    var lastBrace = rawText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      rawText = rawText.substring(firstBrace, lastBrace + 1);
    }

    try {
      var parsedReport = JSON.parse(rawText);
      return res.status(200).json(parsedReport);
    } catch(e) {
      return res.status(200).json(result.body);
    }

  } catch(error) {
    return res.status(500).json({ error: error.message });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
  maxDuration: 60
};
