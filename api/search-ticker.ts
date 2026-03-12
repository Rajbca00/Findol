import { GoogleGenAI } from '@google/genai';
import YahooFinance from 'yahoo-finance2';
import { getApiKey } from './_lib/env';
import { sendMethodNotAllowed } from './_lib/http';

const yahooFinance = new YahooFinance();

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  const query = req.query?.q as string | undefined;
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
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
      return res.status(200).json({
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
      return res.status(200).json({ ...geminiResult, source: 'gemini' });
    }

    return res.status(404).json({ error: 'Ticker not found' });
  } catch (error: any) {
    console.error('Error searching ticker:', error);
    return res.status(500).json({ error: error?.message || 'Search failed' });
  }
}

