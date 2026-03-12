import YahooFinance from 'yahoo-finance2';
import { sendMethodNotAllowed } from './_lib/http';

const yahooFinance = new YahooFinance();

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  const tickers = req.query?.tickers as string | undefined;
  if (!tickers) {
    return res.status(400).json({ error: 'Tickers are required' });
  }

  const tickerList = tickers
    .split(',')
    .map((ticker) => ticker.trim().toUpperCase())
    .filter(Boolean);

  try {
    const results = await Promise.all(
      tickerList.map(async (ticker) => {
        try {
          const quote = (await yahooFinance.quote(ticker)) as any;
          return {
            ticker,
            price: quote.regularMarketPrice,
            name: quote.shortName || quote.longName,
            currency: quote.currency,
          };
        } catch (error) {
          console.error(`Error fetching ${ticker}:`, error);
          return { ticker, error: 'Not found' };
        }
      })
    );

    return res.status(200).json(results);
  } catch (error) {
    console.error('Error fetching prices:', error);
    return res.status(500).json({ error: 'Failed to fetch prices' });
  }
}

