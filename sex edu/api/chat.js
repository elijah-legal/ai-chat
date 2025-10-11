/**
 * Vercel Serverless Function: Gemini API Proxy
 * Purpose: Securely handles streaming requests to the Gemini API.
 * * 1. Hides the GEMINI_API_KEY by accessing it from Vercel's environment variables.
 * 2. Uses Node.js's native fetch and Response streaming for real-time, character-by-character output.
 */

// Reads the API key securely from Vercel's environment variables.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// The official Gemini API endpoint for content generation
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';

// Handler for Vercel Serverless Function
export default async function handler(req, res) {
    // 1. Initial Checks (Security and Configuration)
    if (req.method !== 'POST') {
        // Only allow POST requests from the client-side
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (!GEMINI_API_KEY) {
        // Fail if the environment variable is not set (API Key is missing)
        return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is not set.' });
    }

    // Since Vercel is set up, the client request body (req.body) should contain:
    // { contents: [{ parts: [{ text: "User prompt" }] }], systemInstruction: { ... } }
    const requestBody = req.body;
    
    // Ensure the model knows we want streaming output
    requestBody.config = {
        ...(requestBody.config || {}),
        stream: true
    };

    try {
        // 2. Forward the request to the Gemini API
        const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        // 3. Handle non-OK responses from Gemini (e.g., rate limits, invalid keys)
        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.text();
            console.error('Gemini API Error:', geminiResponse.status, errorData);
            return res.status(geminiResponse.status).json({ 
                error: 'Gemini API call failed.', 
                details: errorData.substring(0, 100) // Truncate details for security
            });
        }
        
        // 4. Set up the Response Headers for Streaming
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Cache-Control', 'no-cache');
        res.flushHeaders();

        // 5. Stream the Response back to the client
        const reader = geminiResponse.body.getReader();
        const decoder = new TextDecoder('utf-8');

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);

            // Vercel serverless function outputs to the response stream
            res.write(chunk);
        }

        // 6. Close the response stream
        res.end();

    } catch (error) {
        console.error('Proxy Fetch Error:', error);
        res.status(500).end(`Proxy server error: ${error.message}`);
    }
}
