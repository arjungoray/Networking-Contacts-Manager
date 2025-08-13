import { authenticateRequest } from "./middleware.js";
import { convexTools } from "./convex-tools.js";
//import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

// Extend globalThis interface
declare global {
  var PUBLIC_CONVEX_URL: string;
  var CLERK_SECRET_KEY: string;
  var CLERK_PUBLISHABLE_KEY: string;
  var BASE_URL: string;
}

// Allowed HTTP methods for protected routes
const allowedMethods = ["POST", "PUT", "GET", "DELETE", "OPTIONS"];

// CORS headers for all responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

// Helper function to create JSON responses with CORS
function jsonResponse(data: any, status = 200): Response {
  try {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error(
      "[WORKER] jsonResponse: ERROR creating response:",
      (error as Error).message,
    );
    throw error;
  }
}

// Helper function to handle CORS preflight requests
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// Response schema for structured output
const responseSchema = z.object({
  message: z.string().describe('A clear, descriptive response to the user. This should either ask a clarifying question if more information is needed, or provide a helpful summary of what was accomplished.'),
  success: z.boolean().describe('Whether any requested action was successful. Set to true if the user request was fulfilled or if asking a valid clarifying question. Set to false only if there was an error or failure.'),
  data: z.any().optional().describe('Any data resulting from tool execution (e.g., a list of contacts, search results). Leave undefined if no data to return.'),
});

// Main fetch handler for Cloudflare Workers
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    try {
      // Handle CORS preflight requests
      if (method === "OPTIONS") {
        return handleCORS();
      }

      // Handle the protected route
      if (url.pathname === "/") {
        return await handleProtectedRoute(request, env);
      }

      // 404 for unmatched routes
      return jsonResponse({ error: "Route not found" }, 404);
    } catch (error) {
      console.error("[WORKER] fetch: ERROR:", (error as Error).message);
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  },
};

// Protected route handler
async function handleProtectedRoute(request: Request, env: any): Promise<Response> {
  try {
    // Only allow specified methods for the protected route
    console.log(
      "[WORKER] handleProtectedRoute: Allowed methods:",
      allowedMethods,
    );

    if (!allowedMethods.includes(request.method)) {
      console.error(
        "[WORKER] handleProtectedRoute: ERROR - Method not allowed:",
        request.method,
      );
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    console.log(
      "[WORKER] handleProtectedRoute: Method is allowed, proceeding with authentication",
    );

    // Authenticate the request
    console.log("[WORKER] handleProtectedRoute: Calling authenticateRequest");
    const { userId, auth } = await authenticateRequest(request, env);
    console.log(
      "[WORKER] handleProtectedRoute: Authentication successful for userId:",
      userId,
    );

    // Get the JWT token for Convex from Clerk
    console.log(
      "[WORKER] handleProtectedRoute: Getting Convex token from Clerk",
    );
    const convexToken = await auth?.getToken({ template: "convex" });

    if (!convexToken) {
      console.error(
        "[WORKER] handleProtectedRoute: ERROR - Failed to get Convex token",
      );
      return jsonResponse({ error: "Failed to get Convex token" }, 401);
    }

    console.log(
      "[WORKER] handleProtectedRoute: Convex token obtained successfully",
    );

    // Get the request body
    console.log("[WORKER] handleProtectedRoute: Parsing request body");
    let body;
    try {
      body = await request.json();
      console.log(
        "[WORKER] handleProtectedRoute: Request body parsed successfully",
      );
    } catch (error) {
      console.error(
        "[WORKER] handleProtectedRoute: ERROR parsing request body:",
        error,
      );
      return jsonResponse({ error: "Invalid JSON in request body" }, 400);
    }

    const { messages } = body;
    console.log("[WORKER] handleProtectedRoute: Extracted messages from body");

    if (!messages || !Array.isArray(messages)) {
      console.error(
        "[WORKER] handleProtectedRoute: ERROR - Invalid messages format:",
        messages,
      );
      return jsonResponse(
        {
          error: 'Request body must include a "messages" array.',
        },
        400,
      );
    }

    // Set environment variables for global access
    globalThis.PUBLIC_CONVEX_URL = env.PUBLIC_CONVEX_URL;
    globalThis.CLERK_SECRET_KEY = env.CLERK_SECRET_KEY;
    globalThis.CLERK_PUBLISHABLE_KEY = env.CLERK_PUBLISHABLE_KEY;
    globalThis.BASE_URL = env.BASE_URL;

    // Initialize the AI model (Groq)
    if (!env.GROQ_API_KEY) {
      console.error("[WORKER] Missing GROQ_API_KEY");
      return jsonResponse({ error: "Groq API key is not configured" }, 500);
    }


    // Initialize Groq provider with explicit API key
    const groq = createGroq({
      apiKey: env.GROQ_API_KEY,
    });
    const model = groq("openai/gpt-oss-120b");

    /*
    // Initialize Google provider with explicit API key
    const google = createGoogleGenerativeAI({
      apiKey: env.GOOGLE_API_KEY,
    });
    const model = google('gemini-2.0-flash-lite');
    */

    // Initialize tools
    const tools = convexTools(convexToken, env);

    console.log(
      "[WORKER] AI Request - Messages:",
      messages.length,
      "Tools:",
      Object.keys(tools),
    );

    // Convert messages to the format expected by Vercel AI SDK
    const formattedMessages = messages
      .filter((msg: any) => msg.role === "user" || msg.role === "assistant")
      .filter((msg: any) => msg.content && msg.content.trim() !== "") // Filter out empty messages
      .map((msg: any) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

    const systemPrompt = `You are a helpful contact management assistant. You MUST either use the available tools to fulfill user requests OR ask specific clarifying questions. Never provide vague responses like "I am retrieving your contacts" without actually using tools.

CRITICAL RULES:
0. If a tool requires a contact ID, FIRST call resolveContactIds with whatever the user provides (name, email, phone, company, LinkedIn, or any description) to obtain the ID(s). The user should NEVER be asked to provide raw IDs.
1. If the user asks to see/list/get contacts, you MUST call the listContacts tool
2. If the user wants to add/create/save a contact, you MUST call the createContact tool
3. If the user wants to delete/remove a contact, you MUST call the deleteContact tool
4. If the user wants to search/find contacts, you MUST call the searchContacts tool
5. If the user wants to update/edit a contact, you MUST call the updateContact tool
6. If the user wants a specific contact by ID, you MUST call the getContactById tool (but use resolveContactIds first if the user didn’t provide an ID)

TAGS RULES:
7. If the user asks to list available tags, call listTags.
8. If the user asks to create a tag, call createTag (ask for name and optional color if missing).
9. If the user asks to rename or recolor a tag, call updateTag.
10. If the user asks to delete a tag, call deleteTag.
11. If the user asks to see a contact's tags, call getContactTags (resolve the contact first if you don't have the ID).
12. If the user asks to add tags to a contact, call addTagsToContact with the contactId (resolved) and tagIds. If user gives tag names, first use listTags and match names; if needed, ask to clarify which tags.
13. If the user asks to remove tags from a contact, call removeTagsFromContact with the contactId (resolved) and tagIds. If user gives tag names, first use listTags and match names.

Disambiguation without asking for IDs:
- If multiple contacts match, present the top matches (with names, emails, and IDs internally) and ask the user which one they mean by human-readable info (e.g., name/company/email). Do NOT ask them to provide an ID.
- If multiple tags match a given name (case-insensitive), present the options (name and color) and ask the user which one they mean.
- Only ask clarifying questions when absolutely necessary to choose the correct contact.

Examples of CORRECT behavior:
- User: "show me my contacts" → USE listContacts → Provide results
- User: "find John" → USE searchContacts → Show matching contacts
- User: "delete John Smith at Acme" → USE resolveContactIds(query: "John Smith at Acme") → If single result, USE deleteContact with that ID; if multiple, show disambiguation without asking for IDs
- User: "update john@acme.com phone to 555-1212" → USE resolveContactIds(query: "john@acme.com") → then USE updateContact with the resolved ID
- User: "add a contact" → ASK for details needed to create the contact (name, email, etc.)
 - User: "list my tags" → USE listTags → Provide results
 - User: "create a tag called VIP" → USE createTag(name: "VIP") → Confirm creation
 - User: "add VIP to John Smith" → USE resolveContactIds("John Smith") → USE listTags → find tagId for "VIP" → USE addTagsToContact(contactId, [tagId])
 - User: "remove VIP from john@acme.com" → USE resolveContactIds("john@acme.com") → USE listTags → resolve "VIP" id → USE removeTagsFromContact(contactId, [tagId])

NEVER respond with vague messages like "I am retrieving..." or "Let me get..." - either use the tools immediately or ask for missing information.

Always provide helpful, descriptive responses that include actual results when tools are used.`;

    try {
      // Manual tool-handling loop so tool outputs are fed back into the model
      const conversation: any[] = [...formattedMessages];
      let finalResult: any = null;

      for (let step = 0; step < 5; step++) {
        const stepResult = await generateText({
          model: model,
          /*
          providerOptions: {
            groq: {
              reasoningFormat: 'hidden',
              reasoningEffort: 'none',
              parallelToolCalls: true, // Enable parallel function calling (default: true)
            }
          },
          */
          system: systemPrompt,
          messages: conversation as any,
          tools,
        });

        console.log(`[WORKER] Step ${step + 1} result text length:`, stepResult.text?.length || 0);
        console.log(`[WORKER] Step ${step + 1} content:`, stepResult.content);
        console.log(`[WORKER] Step ${step + 1} toolResults:`, stepResult.toolResults);
        console.log(`[WORKER] Step ${step + 1} usage:`, stepResult.usage);

        // If we got final text, stop.
        if (stepResult.text && stepResult.text.trim().length > 0) {
          finalResult = stepResult;
          break;
        }

        // If there were tool results but no final text, summarize results as plain text
        // and feed that back as an assistant message the model can read.
        if (stepResult.toolResults && stepResult.toolResults.length > 0) {
          try {
            const summarized = stepResult.toolResults.map((tr: any) => {
              const out = tr?.output ?? null;
              // Shallow summarization to avoid huge payloads
              if (out && typeof out === 'object') {
                const clone: any = Array.isArray(out) ? out.slice(0, 5) : { ...out };
                // Common shapes: { success, data, contacts, error }
                if (clone.contacts && Array.isArray(clone.contacts)) {
                  clone.contacts = clone.contacts.slice(0, 10);
                }
                if (clone.data && Array.isArray(clone.data)) {
                  clone.data = clone.data.slice(0, 10);
                }
                return {
                  toolName: tr.toolName,
                  success: clone.success ?? true,
                  summary: clone,
                };
              }
              return { toolName: tr.toolName, summary: out };
            });
            const textBlock = `Tool results available for the model to use:\n${JSON.stringify(summarized)}`;
            conversation.push({ role: 'assistant', content: textBlock });
            continue;
          } catch (e) {
            console.log('[WORKER] Failed to summarize tool results, stopping loop:', e);
          }
        }

        // Fallback: no content and no text; push a clarifying assistant nudge and retry
        conversation.push({
          role: 'assistant',
          content:
            'Reminder: You must respond with at least one sentence. If an action is required, call a tool now. Otherwise, ask a specific clarifying question. Do not leave the response empty.',
        });
        continue;
      }

      const result = finalResult;
      console.log("[WORKER] AI final result prepared");
      console.log("[WORKER] Final result text length:", result?.text?.length || 0);
      console.log("[WORKER] Final result toolResults:", result?.toolResults);

      // Parse any tool results or structured data from the response
      let responseData = null;
      // Success is true only when we have a non-empty message
      let successFlag = Boolean(result?.text && result.text.trim().length > 0);
      // Provide a safe fallback message when the model returned empty text
      let message = (result?.text && result.text.trim()) ||
        "I didn’t generate a response. Please tell me what you’d like to do: list contacts, search, create, update, or delete a contact.";

      if (result?.toolResults && result.toolResults.length > 0) {
        try {
          responseData = result.toolResults.map((tr: any) => tr);
        } catch (e) {
          console.log("[WORKER] Could not extract tool results:", e);
        }
      }

      console.log("[WORKER] Returning response with message length:", message.length);

      return jsonResponse({
        message,
        success: successFlag,
        data: responseData,
      });

    } catch (error) {
      console.error("[WORKER] Error during AI generation:", error);

      // Try to extract meaningful error information
      let errorMessage = "I encountered an error while processing your request.";
      let statusCode = 500;
      const errorMsg = (error as Error).message;

      if (errorMsg?.includes("authentication") && errorMsg?.includes("failed")) {
        errorMessage = "Authentication failed. Please try logging in again.";
        statusCode = 401;
      } else if (errorMsg?.includes("rate limit")) {
        errorMessage = "I'm currently experiencing high demand. Please try again in a moment.";
        statusCode = 429;
      } else if (errorMsg?.includes("invalid") && errorMsg?.includes("request")) {
        errorMessage = "There was an issue with your request format. Please try again.";
        statusCode = 400;
      }

      return jsonResponse(
        {
          message: errorMessage,
          success: false,
        },
        statusCode,
      );
    }
  } catch (error) {
    console.error("[WORKER] ERROR:", (error as Error).message);

    let statusCode = 500;
    let message = "An internal error occurred. Please try again.";
    const errorMsg = (error as Error).message;

    if (
      errorMsg === "Authorization header missing" ||
      errorMsg === "Unauthorized"
    ) {
      statusCode = 401;
      message = "Authentication failed. Please log in again.";
    } else if (errorMsg.includes("Invalid JSON")) {
      statusCode = 400;
      message = "Invalid request format. Please check your request and try again.";
    }

    return jsonResponse(
      {
        message: message,
        success: false,
      },
      statusCode,
    );
  }
}