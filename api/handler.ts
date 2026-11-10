import type { IncomingMessage, ServerResponse } from 'http';
import { handleApiRequest } from '../src/server/api-dispatcher';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const handled = await handleApiRequest(req, res);
    if (!handled) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, message: 'API route not found' }));
    }
  } catch (error) {
    console.error('Vercel API error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, message: 'Internal Server Error' }));
  }
}
