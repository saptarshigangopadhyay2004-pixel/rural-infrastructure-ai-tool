exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Missing GROQ_API_KEY environment variable.'
        })
      };
    }

    const body = JSON.parse(event.body || '{}');

    const region = String(body.region || 'Not specified').slice(0, 120);
    const infra = String(body.infra || 'Not specified').slice(0, 120);
    const desc = String(body.desc || '').trim().slice(0, 2000);

    if (!desc || desc.length < 30) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Please provide a longer problem description.'
        })
      };
    }

    const prompt = `You are an expert in rural infrastructure development and SDG 9.

Context:
- Region type: ${region}
- Infrastructure domain: ${infra}
- Problem description: ${desc}

Respond ONLY in valid JSON format:

{
  "problem_summary": "One clear sentence summarizing the core problem",
  "root_causes": ["cause 1", "cause 2", "cause 3"],
  "impact": "2-3 sentences on how this affects the community",
  "solutions": [
    {
      "title": "Short-term (0-6 months)",
      "description": "Immediate actionable step"
    },
    {
      "title": "Medium-term (6-24 months)",
      "description": "Infrastructure intervention"
    },
    {
      "title": "Long-term (2-5 years)",
      "description": "Sustainable solution"
    }
  ],
  "innovation_angle": "One innovative technology or approach",
  "sdg9_alignment": "How this aligns with SDG 9",
  "stakeholders": ["stakeholder 1", "stakeholder 2", "stakeholder 3"],
  "estimated_impact": "Expected impact"
}`;

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.4,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: data.error?.message || "Groq API request failed."
        })
      };
    }

    const text = data.choices?.[0]?.message?.content?.trim();

    if (!text) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          error: "Empty AI response."
        })
      };
    }

    let parsed;

    try {
      parsed = JSON.parse(
        text.replace(/```json|```/g, '').trim()
      );
    } catch (err) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          error: "AI returned invalid JSON."
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(parsed)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || "Server error."
      })
    };
  }
};
