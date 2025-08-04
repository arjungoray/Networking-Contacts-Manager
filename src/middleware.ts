import { createClerkClient } from '@clerk/backend';

// Middleware to authenticate requests
export const authenticateRequest = async (request: Request) => {
  try {
    // Create Clerk client (moved inside function to access env at runtime)
    const clerkClient = createClerkClient({
      secretKey: globalThis.CLERK_SECRET_KEY || process.env?.CLERK_SECRET_KEY,
      publishableKey: globalThis.CLERK_PUBLISHABLE_KEY || process.env?.CLERK_PUBLISHABLE_KEY,
    });

    // Get the authorization header from the request
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      throw new Error('Authorization header missing');
    }

    // Extract the token from the Bearer header
    const token = authHeader.replace('Bearer ', '');

    // Validate and construct the URL
    const baseUrl = globalThis.BASE_URL || process.env?.BASE_URL || 'http://localhost:8787';
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
    if (toAuth && toAuth.isAuthenticated && 'userId' in toAuth) {
      return { userId: toAuth.userId, auth: toAuth };
    } else {
      throw new Error('Unauthorized');
    }
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
};