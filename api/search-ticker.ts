import { GoogleGenAI } from '@google/genai';
import YahooFinance from 'yahoo-finance2';
import { getApiKey } from './_lib/env';

const yahooFinance = new YahooFinance();
export const runtime = 'nodejs';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q') || undefined;
  if (!query) {
    return json({ error: 'Query is required' }, 400);
  }

  try {
    let searchResults = (await yahooFinance.search(query)) as any;

    if (searchResults.quotes.length === 0 && query.split(' ').length > 2) {
      const simplifiedQuery = query.split(' ').slice(0, 2).join(' ');
      searchResults = (await yahooFinance.search(simplifiedQuery)) as any;
    }

    let bestMatch = searchResults.quotes.find(
      (quote: any) =>
        (quote.quoteType === 'EQUITY' || quote.quoteType === 'MUTUALFUND') &&
        (quote.symbol.includes('.NS') || quote.symbol.includes('.BO') || !quote.symbol.includes('.'))
    );

    if (!bestMatch) {
      bestMatch = searchResults.quotes.find(
        (quote: any) => quote.quoteType === 'EQUITY' || quote.quoteType === 'MUTUALFUND'
      );
    }

    if (!bestMatch && searchResults.quotes.length > 0) {
      bestMatch = searchResults.quotes[0];
    }

    if (bestMatch?.symbol) {
      return json({
        ticker: bestMatch.symbol,
        name: bestMatch.shortname || bestMatch.longname || bestMatch.symbol,
        source: 'yahoo',
      });
    }

    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const prompt = `Identify the most likely stock or mutual fund ticker symbol for the company or fund named "${query}".
If it's an Indian company, prefer the NSE ticker (ending in .NS).
Return ONLY a JSON object with "ticker" and "name" keys.
Example: {"ticker": "RELIANCE.NS", "name": "Reliance Industries"}.
If you can't find it, return {"ticker": null, "name": null}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    const text = response.text || '{}';
    const cleanJson = text.replace(/```json|```/g, '').trim();
    let geminiResult;

    try {
      geminiResult = JSON.parse(cleanJson);
    } catch {
      const jsonMatch = cleanJson.match(/\{.*\}/s);
      if (!jsonMatch) {
        throw new Error('Could not parse Gemini response as JSON');
      }
      geminiResult = JSON.parse(jsonMatch[0]);
    }

    if (geminiResult?.ticker) {
      return json({ ...geminiResult, source: 'gemini' });
    }

    return json({ error: 'Ticker not found' }, 404);
  } catch (error: any) {
    console.error('Error searching ticker:', error);
    return json({ error: error?.message || 'Search failed' }, 500);
  }
}

export async function POST() {
  return json({ error: 'Method not allowed' }, 405);
}
