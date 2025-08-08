# Contacs API Endpoint Documentation

## Endpoint

`POST https://ai-caption-backend.arjungoray.workers.dev/`

---

## Description

This endpoint provides a protected interface for interacting with a world-class contact management assistant powered by AI. It requires authentication and expects a specific request body format. The AI agent can clarify ambiguous requests or execute contact management actions, returning structured responses.

---

## Request

### Headers

- `Authorization`: Bearer token (required, provided by Clerk authentication)
- `Content-Type`: `application/json`

### Body

```
{
  "messages": [
    // Array of message objects representing the chat history
    // Each message should follow the format expected by the AI model, e.g.:
    {
      "role": "user" | "assistant",
      "content": "<message text>"
    }
  ]
}
```

- `messages` (array, required): The chat history or conversation context. Must be an array of message objects. If missing or not an array, the API returns a 400 error.

---

## Responses

### Success (Execution Mode)

- **Status:** `200 OK`
- **Content-Type:** `application/json`
- **Body:**

```
{
  "type": "data",
  "payload": {
    "success": true | false,
    "message": "<summary of the result>",
    "data": { /* relevant data object or array */ }
  }
}
```

- `success`: Boolean indicating if the operation succeeded.
- `message`: User-friendly summary of the result (e.g., "Contact 'Jane Doe' was created.").
- `data`: The relevant data (e.g., contact object, array of contacts, or deleted contact ID).

### Clarification (Clarification Mode)

- **Status:** `200 OK`
- **Content-Type:** `application/json`
- **Body:**

```
{
  "type": "text",
  "payload": {
    "content": "<clarifying question>"
  }
}
```

- The assistant will respond with a plain-text clarifying question if the user's request is ambiguous or more information is needed.

### Error

- **Status:** `401 Unauthorized` or `400 Bad Request` or `500 Internal Server Error`
- **Content-Type:** `application/json`
- **Body:**

```
{
  "type": "error",
  "payload": {
    "message": "<error message>"
  }
}
```

---

## Example Usage

### Request

```
POST /
Authorization: Bearer <token>
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "Add John Doe to my contacts." }
  ]
}
```

### Success Response

```
{
  "type": "data",
  "payload": {
    "success": true,
    "message": "Contact 'John Doe' was created.",
    "data": {
      "id": "abc123",
      "name": "John Doe",
      // ...other contact fields...
    }
  }
}
```

### Clarification Response

```
{
  "type": "text",
  "payload": {
    "content": "There are multiple Johns. Which one do you want to delete?"
  }
}
```

### Error Response

```
{
  "type": "error",
  "payload": {
    "message": "Failed to get Convex token"
  }
}
```

---

## Notes

- The endpoint is protected and requires valid authentication.
- The AI agent will always return either a structured JSON object (for successful operations) or a plain-text clarifying question.
- All errors are returned in a consistent error format.
