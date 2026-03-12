import { GoogleGenAI } from '@google/genai';
import { getApiKey } from './_lib/env';
import { sendMethodNotAllowed } from './_lib/http';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }

  const { messages, context } = req.body as {
    messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
    context?: unknown;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages are required' });
  }

  try {
    const recentTranscript = messages
      .slice(-10)
      .map((message) => `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${message.content}`)
      .join('\n\n');

    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const prompt = [
      'You are FinDol Copilot, an in-app financial assistant.',
      'Use the provided user financial context when relevant.',
      'Give practical, concise guidance in plain language.',
      'Do not claim certainty about future returns or market direction.',
      'Do not present yourself as a licensed financial advisor.',
      'For high-risk decisions, include a short caution and note key assumptions.',
      'If the user asks about a loan, EMI, prepayment, cashflow, allocation, or investment choice, reason from their provided data first.',
      '',
      `User financial context:\n${JSON.stringify(context || {}, null, 2)}`,
      recentTranscript ? `Recent conversation:\n${recentTranscript}` : '',
      "Answer the user's latest request using the financial context and transcript above.",
    ]
      .filter(Boolean)
      .join('\n\n');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
    });

    return res.status(200).json({
      reply: response.text?.trim() || 'I could not generate a response.',
    });
  } catch (error: any) {
    console.error('Error in financial chat:', error);
    return res.status(500).json({ error: error?.message || 'Financial chat failed' });
  }
}

