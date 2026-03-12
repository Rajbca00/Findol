export const getApiKey = () => {
  const key = process.env.GEMINI_API_KEY || process.env.API_KEY;

  if (!key) {
    throw new Error('Gemini API key is missing. Please configure GEMINI_API_KEY in environment.');
  }

  return key;
};

