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

    function callAPI(systemPrompt, userPrompt, maxTokens) {
      return new Promise(function(resolve, reject) {
        var postData = JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        });

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
              var parsed = JSON.parse(data);
              var text = parsed.content[0].text;
              text = text.replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '').trim();
              var first = text.indexOf('{');
              var last = text.lastIndexOf('}');
              if (first !== -1 && last !== -1) {
                resolve(JSON.parse(text.substring(first, last + 1)));
              } else {
                reject(new Error('No JSON: ' + text.substring(0, 100)));
              }
            } catch(e) { reject(e); }
          });
        });
        req2.on('error', reject);
        req2.write(postData);
        req2.end();
      });
    }

    var userInfo = body.user;

    var part1 = await callAPI(
      'JSONのみで返答。コードフェンス禁止。',
      userInfo + '\n\n以下のJSONのみで返答:\n{"summary":"200文字以内の総評","urgency_score":0から100の数値,"urgency_label":"緊急度ラベル","risks":[{"title":"タイトル","description":"100文字以内","urgency":"high","hidden_fact":"50文字以内"}],"solutions":[{"priority":1,"title":"タイトル","description":"100文字以内","timeframe":"期間","cost":"費用","cost_reduction_tip":"50文字以内"}]}',
      2000
    );

    var part2 = await callAPI(
      'JSONのみで返答。コードフェンス禁止。',
      userInfo + '\n\n以下のJSONのみで返答:\n{"checklist":[{"task":"タスク","deadline":"今週中","priority":"high","reason":"50文字以内"}],"expert_costs":[{"expert":"専門家名","cost":"費用","reason":"50文字以内","negotiable":"交渉可否","warning":"50文字以内"}],"deadlines":[{"period":"期限","task":"手続き","importance":"high","risk_if_missed":"50文字以内"}],"warnings":[{"title":"タイトル","description":"100文字以内"}]}',
      2000
    );

    var reportData = Object.assign({}, part1, part2);
    return res.status(200).json(reportData);

  } catch(error) {
    console.error('Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

export const config = {
  api: { bodyParser: true },
  maxDuration: 60
};
