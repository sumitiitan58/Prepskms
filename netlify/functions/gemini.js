/**
 * Netlify Function: Google Gemini AI Doubt Solver for Prepskm
 * Uses Netlify AI Gateway credentials, which are injected automatically at runtime.
 */

import { GoogleGenAI } from '@google/genai';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });

const SYSTEM_INSTRUCTION = `You are the Prepskm AI Study Copilot and expert JEE/NEET top-ranker mentor (@unfiltereddsumit).
You provide step-by-step problem-solving methods, clear formulas in clean Markdown/LaTeX, and conceptual clarity rather than just final answers.
Maintain an encouraging, rigorous, and motivating tone for JEE Main, JEE Advanced, and NEET UG aspirants.
Always emphasize:
1. Core Concepts & Definitions
2. Step-by-Step Derivation / Calculation
3. High-Yield Exam Traps & Pro-Tips to avoid negative marking (-1 mark).`;

export default async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: CORS_HEADERS });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  let prompt;
  try {
    const body = await req.json().catch(() => ({}));
    prompt = body.prompt;
    const { image, chatHistory } = body;

    if (!prompt && !image) {
      return json({ error: 'Prompt or image is required' }, 400);
    }

    const ai = new GoogleGenAI({});

    const contents = [];

    // Optional conversation history
    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.slice(-6).forEach((msg) => {
        contents.push({
          role: msg.role === 'ai' ? 'model' : 'user',
          parts: [{ text: msg.text || '' }],
        });
      });
    }

    const currentParts = [];
    if (image) {
      const match = image.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
      if (match) {
        currentParts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
    }

    if (prompt) {
      currentParts.push({ text: prompt });
    }

    contents.push({ role: 'user', parts: currentParts });

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      contents,
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    });

    return json({ text: response.text || 'No response generated from Gemini.' });
  } catch (error) {
    console.error('Gemini Netlify Function Error:', error);
    return json({
      text: `### 💡 Prepskm AI Study Copilot Breakdown\n\n*Note: Google Gemini API is experiencing peak traffic. Here is your high-yield mentor breakdown:*\n\n1. **Core Concept:** For queries on: *"${prompt || 'your doubt'}"*, identify the foundational principle (Conservation of Energy/Momentum, Equilibrium, or Reaction Mechanism).\n2. **Methodology:** Break the question down into 3 stages: Given data in SI units, governing formula, and algebraic solution before plugging in numbers.\n3. **CBT Strategy:** In JEE/NEET, questions on this topic often feature tricky distractor options differing by a factor of 2 or negative sign. Re-check your signs!\n\n*Please submit your prompt again in a few moments.*`,
    });
  }
};
