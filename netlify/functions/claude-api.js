exports.handler = async function(event, context) {
  // CORS対応
  var headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    var body = JSON.parse(event.body);
    var apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return { statusCode: 500, headers: headers, body: JSON.stringify({ error: 'API key not configured' }) };
    }

    var requestBody = {
      model: body.model || 'claude-haiku-4-5-20251001',
      max_tokens: body.max_tokens || 4000,
      system: body.system,
      messages: [{ role: 'user', content: body.user }]
    };

    var https = require('https');
    var postData = JSON.stringify(requestBody);

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

      var req = https.request(options, function(res) {
        var data = '';
        res.on('data', function(chunk) { data += chunk; });
        res.on('end', function() {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch(e) {
            reject(new Error('Parse error: ' + data));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    return {
      statusCode: result.statusCode,
      headers: headers,
      body: JSON.stringify(result.body)
    };

  } catch(error) {
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
