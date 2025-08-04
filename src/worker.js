import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { authenticateRequest } from './middleware.js';
import { convexTools } from './convex-tools.js';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Helper function to create JSON responses with CORS
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

// Helper function to handle CORS preflight requests
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// Main fetch handler for Cloudflare Workers
export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const method = request.method;

      // Handle CORS preflight requests
      if (method === 'OPTIONS') {
        return handleCORS();
      }

      // Handle the protected route
      if (url.pathname === '/') {
        return await handleProtectedRoute(request, env);
      }

      // 404 for unmatched routes
      return jsonResponse({ error: 'Route not found' }, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  },
};

// Protected route handler (converted from Express)
async function handleProtectedRoute(request, env) {
  try {
    // Only allow POST, PUT methods for the protected route
    if (!['POST', 'PUT', 'OPTIONS', 'DELETE', 'PATCH', 'GET'].includes(request.method)) {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    // Authenticate the request
    const { userId, auth } = await authenticateRequest(request, env);

    // Get the JWT token for Convex from Clerk
    const convexToken = await auth?.getToken({ template: 'convex' });
    if (!convexToken) {
      return jsonResponse({ error: 'Failed to get Convex token' }, 401);
    }

    // Get the request body
    const body = await request.json();
    const { messages } = body;
    
    if (!messages || !Array.isArray(messages)) {
      return jsonResponse({ 
        error: 'Request body must include a "messages" array.' 
      }, 400);
    }

    // Set environment variables for global access
    globalThis.PUBLIC_CONVEX_URL = env.PUBLIC_CONVEX_URL;
    globalThis.CLERK_SECRET_KEY = env.CLERK_SECRET_KEY;
    globalThis.CLERK_PUBLISHABLE_KEY = env.CLERK_PUBLISHABLE_KEY;
    globalThis.BASE_URL = env.BASE_URL;

    // Initialize the AI model and tools
    const groq = createGroq({
      apiKey: env.GROQ_API_KEY,
    });
    const tools = convexTools(convexToken, env);

    // Call the AI with the enhanced system prompt
    const { text: finalResponseText } = await generateText({
      model: groq("moonshotai/kimi-k2-instruct"),
      messages: messages,
      tools: tools,
      system: `You are a world-class contact management assistant. You have two modes of response.

      1.  **Clarification Mode:** If the user's request is ambiguous or you need more information to use a tool (e.g., they say "delete John" and you find multiple Johns), you MUST respond with ONLY the clarifying question in plain text. Do not add any extra conversational text.

      2.  **Execution Mode:** After you have successfully executed a tool that fetches, creates, updates, or deletes data, your FINAL response MUST be a single, clean, minified JSON object and nothing else. This object must have three fields:
          - "success": a boolean (true or false).
          - "message": a user-friendly string summarizing the result (e.g., "Contact 'Jane Doe' was created.").
          - "data": an object or array containing ONLY the relevant data (e.g., the contact object, an array of found contacts, or the ID of a deleted contact).

      Your goal is to be efficient. Ask questions if you must, but once you have enough information, execute the tool and return the structured JSON data.`,
    });

    // Parse the AI's response and send a structured reply
    try {
      // Attempt to parse the AI's response as JSON (Execution Mode)
      const jsonPayload = JSON.parse(finalResponseText);
      return jsonResponse({
        type: 'data',
        payload: jsonPayload,
      });
    } catch (e) {
      // If parsing fails, it's a conversational, plain-text response (Clarification Mode)
      return jsonResponse({
        type: 'text',
        payload: {
          content: finalResponseText,
        },
      });
    }

  } catch (error) {
    console.error('Error in protected route:', error);
    const statusCode = error.message === 'Authorization header missing' || error.message === 'Unauthorized' ? 401 : 500;
    return jsonResponse({
      type: 'error',
      payload: {
        message: error.message
      }
    }, statusCode);
  }
}
