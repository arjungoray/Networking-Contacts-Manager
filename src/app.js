import express from 'express';
import cors from 'cors';
import { ConvexHttpClient } from 'convex/browser';
import { api } from './convex/_generated/api.js';
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { authenticateRequest } from './middleware.js';
import { convexTools } from './convex-tools.js';
import { stepCountIs } from 'ai';
import 'dotenv/config';

// Initialize Express app
const app = express();
const port = process.env.PORT || 8787;

// Initialize Convex client
const convexUrl = process.env.PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error('PUBLIC_CONVEX_URL environment variable is not set');
}
const convex = new ConvexHttpClient(convexUrl);

// Configure CORS to allow everything
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

// Middleware to parse JSON bodies
app.use(express.json());

// Helper function to handle async route errors
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Protected route handler
app.all('/', asyncHandler(async (req, res) => {
  try {
    // Authenticate the request (Unchanged)
    const { userId, auth } = await authenticateRequest(req);

    // Get the JWT token for Convex from Clerk (Unchanged)
    const convexToken = await auth?.getToken({ template: 'convex' });
    if (!convexToken) {
      return res.status(401).json({ error: 'Failed to get Convex token' });
    }

    // --- ENHANCED AGENT LOGIC ---

    // 1. Get dynamic chat history from the request body.
    // Your frontend should now send a POST/PUT request with a body like: { "messages": [...] }
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Request body must include a "messages" array.' });
    }

    // 2. Initialize the AI model and tools
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_API_KEY,
    });
    const tools = convexTools(convexToken); // Pass the user's token to the tools

    // 3. Call the AI with the enhanced system prompt
    const { text: finalResponseText } = await generateText({
      model: google("models/gemini-2.5-flash-lite"), // Using the recommended model name
      messages: messages, // Use dynamic messages from the request
      tools: tools,
      // This system prompt is the key to getting clean, structured output
      system: `You are a world-class contact management assistant. You have two modes of response.

      1.  **Clarification Mode:** If the user's request is ambiguous or you need more information to use a tool (e.g., they say "delete John" and you find multiple Johns), you MUST respond with ONLY the clarifying question in plain text. Do not add any extra conversational text.

      2.  **Execution Mode:** After you have successfully executed a tool that fetches, creates, updates, or deletes data, your FINAL response MUST be a single, clean, minified JSON object and nothing else. This object must have three fields:
          - "success": a boolean (true or false).
          - "message": a user-friendly string summarizing the result (e.g., "Contact 'Jane Doe' was created.").
          - "data": an object or array containing ONLY the relevant data (e.g., the contact object, an array of found contacts, or the ID of a deleted contact).

      Your goal is to be efficient. Ask questions if you must, but once you have enough information, execute the tool and return the structured JSON data.`,
    });

    // 4. Intelligently parse the AI's response and send a structured reply to the frontend
    try {
      // Attempt to parse the AI's response as JSON (Execution Mode)
      const jsonPayload = JSON.parse(finalResponseText);
      res.status(200).json({
        type: 'data',
        payload: jsonPayload,
      });
    } catch (e) {
      // If parsing fails, it's a conversational, plain-text response (Clarification Mode)
      res.status(200).json({
        type: 'text',
        payload: {
          content: finalResponseText,
        },
      });
    }

  } catch (error) {
    // Error handling remains unchanged
    console.error('Error in protected route:', error);
    const statusCode = error.message === 'Authorization header missing' || error.message === 'Unauthorized' ? 401 : 500;
    res.status(statusCode).json({
      type: 'error',
      payload: {
        message: error.message
      }
    });
  }
}));

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;