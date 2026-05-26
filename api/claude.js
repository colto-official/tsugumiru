export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    var apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    var body = req.body;
    var https = require('https');

    var systemPrompt = 'JSONのみで返答。コードフェンス禁止。以下のJSON構造で返答すること。各項目は簡潔に。\n' +
      '{"summary":"200文字以内","urgency_score":0-100の数値,"urgency_label":"ラベル",' +
      '"risks":[{"title":"タイトル","description":"説明","urgency":"high","hidden_fact":"業界の事実"}],' +
      '"solutions":[{"priority":1,"title":"タイトル","description":"説明","timeframe":"期間","cost":"費用","cost_reduction_tip":"コスト削減"}],' +
      '"checklist":[{"task":"タスク","deadline":"今週中","priority":"high","reason":"理由"}],' +
      '"expert_costs":[{"expert":"専門家","cost":"費用","reason":"理由","negotiable":"交渉可否","warning":"注意"}],' +
      '"deadlines":[{"period":"期限","task":"手続き","importance":"high","risk_if_missed":"リスク"}],' +
      '"warnings":[{"title":"タイトル","description":"説明"}]}';

    var postData = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: 'user', content: body.user }]
    });

    var apiResult = await new Promise(function(resolve, reject) {
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
          try { resolve(JSON.parse(data)); }
          catch(e) { reject(new Error('API parse error: ' + data.substring(0, 200))); }
        });
      });

      req2.on('error', reject);
      req2.write(postData);
      req2.end();
    });

    if (!apiResult.content || !apiResult.content[0]) {
      return res.status(500).json({ error: 'No content in API response' });
    }

    var rawText = apiResult.content[0].text;
    console.log('Raw text length:', rawText.length);
    console.log('Raw text preview:', rawText.substring(0, 200));

    rawText = rawText.replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    var firstBrace = rawText.indexOf('{');
    var lastBrace = rawText.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      return res.status(500).json({ error: 'No JSON found in response', raw: rawText.substring(0, 500) });
    }

    rawText = rawText.substring(firstBrace, lastBrace + 1);

    try {
      var reportData = JSON.parse(rawText);
      return res.status(200).json(reportData);
    } catch(parseError) {
      console.error('JSON parse error:', parseError.message);
      console.error('Raw text:', rawText.substring(0, 500));
      return res.status(500).json({
        error: 'JSON parse failed: ' + parseError.message,
        raw: rawText.substring(0, 500)
      });
    }

  } catch(error) {
    console.error('Handler error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

export const config = {
  api: { bodyParser: true },
  maxDuration: 60
};
