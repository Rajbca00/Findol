export const sendMethodNotAllowed = (res: any, allowed: string[]) => {
  res.setHeader('Allow', allowed.join(', '));
  return res.status(405).json({ error: 'Method not allowed' });
};
