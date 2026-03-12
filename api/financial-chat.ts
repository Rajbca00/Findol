import { getApiKey } from './_lib/env';
export const runtime = 'nodejs';
export const maxDuration = 30;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function POST(request: Request) {
  let payload: {
    messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
    context?: unknown;
  };

  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { messages, context } = payload;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'Messages are required' }, 400);
  }

  try {
    const recentTranscript = messages
      .slice(-10)
      .map((message) => `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${message.content}`)
      .join('\n\n');

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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${encodeURIComponent(getApiKey())}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(data.error?.message || 'Gemini request failed');
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim();

    return json({
      reply: reply || 'I could not generate a response.',
    });
  } catch (error: any) {
    console.error('Error in financial chat:', error);
    return json({ error: error?.message || 'Financial chat failed' }, 500);
  }
}

export async function GET() {
  return json({ error: 'Method not allowed' }, 405);
}
