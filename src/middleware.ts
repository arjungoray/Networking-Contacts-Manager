import { createClerkClient } from "@clerk/backend";

// Middleware to authenticate requests
export const authenticateRequest = async (
  request: Request, 
  env: any
): Promise<{ userId: string; auth: any }> => {
  try {
    // Create Clerk client (moved inside function to access env at runtime)
    const clerkClient = createClerkClient({
      secretKey: env?.CLERK_SECRET_KEY,
      publishableKey: env?.CLERK_PUBLISHABLE_KEY,
    });

    // Get the authorization header from the request
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      throw new Error("Authorization header missing");
    }

    // Extract the token from the Bearer header
    const token = authHeader.replace("Bearer ", "");

    // Validate and construct the URL
    const baseUrl =
      env?.BASE_URL || "https://ai-caption-backend.arjungoray.workers.dev/";
    const url = new URL(request.url, baseUrl);

    // Create a Request object
    const clerkRequest = new Request(url.toString(), {
      headers: request.headers,
    });

    // Authenticate the request using Clerk
    const client = await clerkClient.authenticateRequest(clerkRequest);

    // Get the authentication response
    const toAuth = client.toAuth();

    // Check if the response contains a userId
    if (toAuth && toAuth.isAuthenticated && "userId" in toAuth) {
      return { userId: toAuth.userId, auth: toAuth };
    } else {
      throw new Error("Unauthorized");
    }
  } catch (error) {
    console.error("Authentication error:", error);
    throw error;
  }
};
