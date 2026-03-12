import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();
export const runtime = 'nodejs';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function GET(request: Request) {
  const tickers = new URL(request.url).searchParams.get('tickers') || undefined;
  if (!tickers) {
    return json({ error: 'Tickers are required' }, 400);
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

    return json(results);
  } catch (error) {
    console.error('Error fetching prices:', error);
    return json({ error: 'Failed to fetch prices' }, 500);
  }
}

export async function POST() {
  return json({ error: 'Method not allowed' }, 405);
}
