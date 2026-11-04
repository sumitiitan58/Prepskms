import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { GoogleGenAI } from '@google/genai';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'prepskm-gemini-api-middleware',
        configureServer(server) {
          server.middlewares.use('/api/gemini', async (req, res) => {
            if (req.method === 'OPTIONS') {
              res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
              });
              res.end();
              return;
            }
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Method Not Allowed' }));
              return;
            }

            let rawBody = '';
            req.on('data', (chunk) => {
              rawBody += chunk;
            });
            req.on('end', async () => {
              try {
                const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
                if (!apiKey) {
                  res.statusCode = 503;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'GEMINI_API_KEY not configured', fallback: true }));
                  return;
                }

                const body = JSON.parse(rawBody || '{}');
                const ai = new GoogleGenAI({
                  apiKey,
                  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
                });
                const parts: any[] = [];

                if (body.imageBase64 && typeof body.imageBase64 === 'string' && body.imageBase64.includes('base64,')) {
                  const [meta, base64Data] = body.imageBase64.split('base64,');
                  const mimeMatch = meta.match(/data:(.*?);/);
                  parts.push({
                    inlineData: {
                      mimeType: mimeMatch ? mimeMatch[1] : 'image/png',
                      data: base64Data,
                    },
                  });
                }

                parts.push({
                  text: body.prompt || 'Solve this JEE/NEET question step by step.',
                });

                const response = await ai.models.generateContent({
                  model: 'gemini-3.8-flash',
                  contents: [{ role: 'user', parts }],
                  config: {
                    systemInstruction: `You are the official Prepskm AI Study Copilot created by @unfiltereddsumit for JEE Main, JEE Advanced, and NEET UG aspirants. Give step-by-step solutions for Physics, Chemistry, Mathematics, and Biology with Markdown/LaTeX formulas, core concepts, and an AIR Ranker Shortcut tip with encouraging mentorship.`,
                    temperature: 0.4,
                  },
                });

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ reply: response.text || '' }));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err?.message || 'AI Error', fallback: true }));
              }
            });
          });
        },
      },
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
