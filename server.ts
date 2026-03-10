import express from "express";
import { createServer as createViteServer } from "vite";
import YahooFinance from 'yahoo-finance2';
import dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const getApiKey = () => {
  const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!key) {
    console.warn("WARNING: No Gemini API key found in environment variables (GEMINI_API_KEY or API_KEY)");
  }
  return key || "";
};

const yahooFinance = new YahooFinance();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to search for a ticker by name
  app.get("/api/search-ticker", async (req, res) => {
    const query = req.query.q as string;
    console.log(`Searching ticker for: ${query}`);
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    try {
      // 1. Try Yahoo Finance Search
      console.log(`Trying Yahoo Finance Search for: ${query}`);
      let searchResults = await yahooFinance.search(query) as any;
      
      // If no results, try simplifying the query (take first 2 words)
      if (searchResults.quotes.length === 0 && query.split(' ').length > 2) {
        const simplifiedQuery = query.split(' ').slice(0, 2).join(' ');
        console.log(`No results for full query, trying simplified: ${simplifiedQuery}`);
        searchResults = await yahooFinance.search(simplifiedQuery) as any;
      }
      
      // Try strict filter first (NSE/BSE or no dot)
      let bestMatch = searchResults.quotes.find((q: any) => 
        (q.quoteType === 'EQUITY' || q.quoteType === 'MUTUALFUND') && 
        (q.symbol.includes('.NS') || q.symbol.includes('.BO') || !q.symbol.includes('.'))
      );

      // If no strict match, take the first equity/mutual fund result
      if (!bestMatch) {
        bestMatch = searchResults.quotes.find((q: any) => 
          q.quoteType === 'EQUITY' || q.quoteType === 'MUTUALFUND'
        );
      }

      // If still no match, take the very first result if it has a symbol
      if (!bestMatch && searchResults.quotes.length > 0) {
        bestMatch = searchResults.quotes[0];
      }

      if (bestMatch && bestMatch.symbol) {
        console.log(`Found match on Yahoo: ${bestMatch.symbol}`);
        return res.json({ 
          ticker: bestMatch.symbol, 
          name: bestMatch.shortname || bestMatch.longname || bestMatch.symbol,
          source: 'yahoo'
        });
      }

      // 2. Fallback to Gemini
      console.log("Yahoo search returned no results, falling back to Gemini...");
      
      const apiKey = getApiKey();
      if (!apiKey) {
        throw new Error("Gemini API key is missing. Please configure GEMINI_API_KEY in environment.");
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Identify the most likely stock or mutual fund ticker symbol for the company or fund named "${query}". 
      If it's an Indian company, prefer the NSE ticker (ending in .NS). 
      Return ONLY a JSON object with "ticker" and "name" keys. 
      Example: {"ticker": "RELIANCE.NS", "name": "Reliance Industries"}. 
      If you can't find it, return {"ticker": null, "name": null}.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const text = response.text || '{}';
      const cleanJson = text.replace(/```json|```/g, '').trim();
      let geminiResult;
      try {
        geminiResult = JSON.parse(cleanJson);
      } catch (e) {
        // Try to extract JSON if it's embedded in text
        const jsonMatch = cleanJson.match(/\{.*\}/s);
        if (jsonMatch) {
          geminiResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Could not parse Gemini response as JSON");
        }
      }

      if (geminiResult && geminiResult.ticker) {
        console.log(`Found match on Gemini: ${geminiResult.ticker}`);
        return res.json({ ...geminiResult, source: 'gemini' });
      }

      console.log("No match found on Gemini.");
      res.status(404).json({ error: "Ticker not found" });
    } catch (error: any) {
      console.error("Error searching ticker:", error);
      const errorMessage = error.message || "Search failed";
      res.status(500).json({ error: errorMessage });
    }
  });

  // API Route to fetch stock prices
  app.get("/api/prices", async (req, res) => {
    const tickers = req.query.tickers as string;
    if (!tickers) {
      return res.status(400).json({ error: "Tickers are required" });
    }

    const tickerList = tickers.split(',').map(t => t.trim().toUpperCase());
    
    try {
      const results = await Promise.all(
        tickerList.map(async (ticker) => {
          try {
            const quote = await yahooFinance.quote(ticker) as any;
            return {
              ticker,
              price: quote.regularMarketPrice,
              name: quote.shortName || quote.longName,
              currency: quote.currency
            };
          } catch (e) {
            console.error(`Error fetching ${ticker}:`, e);
            return { ticker, error: "Not found" };
          }
        })
      );
      
      res.json(results);
    } catch (error) {
      console.error("Error fetching prices:", error);
      res.status(500).json({ error: "Failed to fetch prices" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
