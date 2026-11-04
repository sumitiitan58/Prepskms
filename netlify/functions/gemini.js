import { GoogleGenAI, ThinkingLevel } from '@google/genai';

/**
 * Netlify Serverless Function: Prepskm Ultra-Fast Real-Time "Prep AI"
 * Endpoint: /.netlify/functions/gemini (Redirected from /api/gemini via netlify.toml)
 *
 * Uses GEMINI_API_KEY configured in Netlify Environment Variables.
 * Optimized for sub-second low-latency responses with step-by-step LaTeX formulas
 * and motivational mentorship under Lead Mentor Sumit (@unfiltereddsumit).
 */
export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed. Use POST.' }),
    };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          error: 'GEMINI_API_KEY is not configured in environment variables.',
          fallback: true,
        }),
      };
    }

    const body = JSON.parse(event.body || '{}');
    const promptText = body.prompt || '';
    const imageBase64 = body.imageBase64 || null;
    const studentName = body.studentName || 'Aspirant';
    const targetExam = body.targetExam || 'JEE Main & Advanced / NEET UG';

    if (!promptText && !imageBase64) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Please provide a question prompt or doubt image.',
        }),
      };
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const parts = [];
    if (
      imageBase64 &&
      typeof imageBase64 === 'string' &&
      imageBase64.includes('base64,')
    ) {
      const [meta, base64Data] = imageBase64.split('base64,');
      const mimeMatch = meta.match(/data:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      parts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });
    }

    parts.push({
      text:
        promptText ||
        'Solve the question shown in this image step-by-step with key formulas and shortcuts.',
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ role: 'user', parts }],
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction: `You are the official Prepskm AI Study Copilot ("Prep AI") working alongside Lead Mentor Sumit (@unfiltereddsumit) for JEE Main, JEE Advanced, and NEET UG aspirants.
Student Name: ${studentName}
Target Exam: ${targetExam}

Guidelines:
1. Act as an elite JEE/NEET tutor and mentor under the Prepskm banner alongside Lead Mentor Sumit (@unfiltereddsumit). Never use the word "Owner"—always say "Lead Mentor" or "Mentor".
2. Provide crystal-clear conceptual step-by-step guidance for Physics, Chemistry, Mathematics, and Biology with formatted LaTeX formulas.
3. Highlight the core formula, dimensional check, or NCERT line first.
4. End with a motivational mentorship note and an "AIR Ranker Shortcut / Exam Trap" tip.`,
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        reply:
          response.text ||
          'Could not generate a response. Please try rephrasing your question.',
      }),
    };
  } catch (error) {
    console.error('Prepskm Gemini Serverless Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error:
          error.message ||
          'Internal Server Error while contacting Gemini AI.',
        fallback: true,
      }),
    };
  }
};
