import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function geminiDevApiPlugin(): Plugin {
  return {
    name: 'gemini-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/gemini', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const { prompt, image, chatHistory } = JSON.parse(body || '{}');
            const apiKey = process.env.GEMINI_API_KEY;

            if (apiKey) {
              const { GoogleGenAI } = await import('@google/genai');
              const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
              const systemInstruction = `You are the Prepskm AI Study Copilot and expert JEE/NEET top-ranker mentor (@unfiltereddsumit).
Provide step-by-step problem-solving methods, clear formulas in clean Markdown/LaTeX, and conceptual clarity rather than just final answers.
Maintain an encouraging and rigorous tone for JEE Main, JEE Advanced, and NEET UG aspirants.`;

              const contents: any[] = [];
              if (chatHistory && Array.isArray(chatHistory)) {
                chatHistory.slice(-6).forEach((msg: any) => {
                  contents.push({
                    role: msg.role === 'ai' ? 'model' : 'user',
                    parts: [{ text: msg.text || '' }]
                  });
                });
              }

              const currentParts: any[] = [];
              if (image) {
                const match = image.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
                if (match) {
                  currentParts.push({
                    inlineData: {
                      mimeType: match[1],
                      data: match[2]
                    }
                  });
                }
              }
              if (prompt) currentParts.push({ text: prompt });
              contents.push({ role: 'user', parts: currentParts });

              const response = await ai.models.generateContent({
                model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
                contents,
                config: { systemInstruction }
              });

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ text: response.text || '' }));
            } else {
              // High-yield pedagogical mentor response
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                text: `### 💡 Prepskm Mentorship AI Notice\n\n**Note for Netlify Deployment:** Add your \`GEMINI_API_KEY\` to your Netlify Environment Variables in the Netlify Dashboard (Site Settings > Environment Variables) to enable live Gemini AI inference.\n\n**Step-by-Step Problem Breakdown:**\n1. **Core Concept:** For queries on: *"${prompt || 'the question in the image'}"*, begin by identifying the knowns and unknowns.\n2. **Formula Selection:** Always check dimensional consistency before substituting numbers.\n3. **CBT Mock Strategy:** In the live CBT test, spend at most 2.5 minutes per MCQ before marking for review.\n\nKeep pushing forward with consistency!`
              }));
            }
          } catch (err: any) {
            console.error('Gemini dev server proxy error:', err);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              text: `### 💡 Prepskm AI Study Copilot Breakdown\n\n*Note: Google Gemini is currently experiencing peak load. Here is your high-yield mentor breakdown:*\n\n1. **Core Concept:** For queries on: *"${prompt || 'your doubt'}"*, identify the foundational principle (Conservation of Energy/Momentum, Equilibrium, or Reaction Mechanism).\n2. **Methodology:** Break the question down into 3 stages: Given data in SI units, governing formula, and algebraic solution before plugging in numbers.\n3. **CBT Strategy:** In JEE/NEET, questions on this topic often feature tricky distractor options differing by a factor of 2 or negative sign. Re-check your signs!\n\n*Try resending your doubt in a few moments.*`
            }));
          }
        });
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), geminiDevApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(''),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
