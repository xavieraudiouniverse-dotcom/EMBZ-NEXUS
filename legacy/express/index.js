require('dotenv').config();
const OpenAI = require('openai').default;
const express = require('express');

const app = express();
app.use(express.json());

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID,
});

// ChatGPT endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, model = 'gpt-3.5-turbo' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: message }],
      temperature: 0.7,
      max_tokens: 2048,
    });

    res.json({
      success: true,
      message: response.choices[0].message.content,
      model,
      usage: response.usage,
    });
  } catch (error) {
    console.error('ChatGPT Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Codex/Code Completion endpoint
app.post('/api/code-completion', async (req, res) => {
  try {
    const { prompt, language = 'javascript', model = 'gpt-3.5-turbo' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are an expert ${language} code generator. Generate clean, efficient code.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });

    res.json({
      success: true,
      code: response.choices[0].message.content,
      language,
      model,
    });
  } catch (error) {
    console.error('Codex Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'embz-nexus' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Embz Nexus server running on port ${PORT}`);
});
