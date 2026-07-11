/**
 * Serverless image proxy for Vercel.
 * Fetches images server-side (bypassing CORS) and returns them
 * with proper CORS headers for browser canvas operations.
 *
 * GET /api/proxy-image?url=<encoded-image-url>
 */

export default async function handler(req, res) {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid url parameter' });
    }

    // Basic URL validation — only allow http/https
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return res.status(400).json({ error: 'Only http and https URLs are allowed' });
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'PromptStudio/1.0 Image Proxy',
            },
            // Follow up to 5 redirects (Pinterest may redirect)
            redirect: 'follow',
        });

        if (!response.ok) {
            return res.status(response.status).json({
                error: `Upstream returned ${response.status}`,
            });
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const buffer = Buffer.from(await response.arrayBuffer());

        // CORS headers so the browser canvas can read the result
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', buffer.length);

        return res.status(200).send(buffer);
    } catch (error) {
        console.error('[proxy-image] Fetch error:', error.message);
        return res.status(502).json({ error: 'Failed to fetch image from upstream' });
    }
}
