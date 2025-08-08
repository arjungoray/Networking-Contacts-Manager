import { z } from "zod";
import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";
import { tool } from 'ai';

// Type definitions for better TypeScript safety
interface Contact {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  company?: string;
  location?: string;
  linkedin?: string;
  notes?: string;
  tags?: string[];
  _creationTime: number;
}

interface Tag {
  _id: string;
  name: string;
  color?: string;
}

interface ConvexToolsEnv {
  PUBLIC_CONVEX_URL?: string;
}

// Define parameter schemas for type inference
const listContactsSchema = z.object({
  limit: z
    .preprocess(
      (val) => (val === null || val === undefined ? undefined : val),
      z.number().int().positive().max(100).optional(),
    )
    .describe(
      "Optional. Maximum number of contacts to retrieve. If null or missing, server will use its default.",
    ),
});

const getContactByIdSchema = z.object({
  id: z.string().describe("The unique ID of the contact to retrieve."),
});

const searchContactsSchema = z.object({
  query: z.string().describe(
    "The search term. Can be a name, email, company, job title, or content from notes."
  ),
});

const createContactSchema = z.object({
  name: z.string().describe("The full name of the contact."),
  email: z.string().optional().describe("The contact's email address."),
  phone: z.string().optional().describe("The contact's phone number."),
  jobTitle: z.string().optional().describe("The contact's job title."),
  company: z.string().optional().describe("The company the contact works for."),
  location: z.string().optional().describe("The city or country of the contact."),
  linkedin: z.string().optional().describe("A URL to the contact's LinkedIn profile."),
  notes: z.string().optional().describe("Any notes about the contact."),
  tags: z.array(z.string()).optional().describe("Optional. Array of tag IDs to associate with the contact."),
});

const updateContactSchema = z.object({
  id: z.string().describe("The unique ID of the contact to update."),
  name: z.string().optional().describe("The new full name of the contact."),
  email: z.string().optional().describe("The new email address."),
  phone: z.string().optional().describe("The new phone number."),
  jobTitle: z.string().optional().describe("The new job title."),
  company: z.string().optional().describe("The new company."),
  location: z.string().optional().describe("The new location."),
  linkedin: z.string().optional().describe("The new LinkedIn profile URL."),
  notes: z.string().optional().describe("Updated notes for the contact."),
  tags: z.array(z.string()).optional().describe("Optional. Full replacement array of tag IDs for the contact."),
});

const deleteContactSchema = z.object({
  contactIds: z.array(z.string()).describe("An array of contact IDs to be deleted."),
});

// Tag-related schemas
const modifyContactTagsSchema = z.object({
  contactId: z.string().describe("The unique ID of the contact to modify."),
  tagIds: z.array(z.string()).min(1).describe("One or more tag IDs to add to or remove from the contact."),
});

// Resolve IDs from any identifiers schema
const resolveContactIdsSchema = z.object({
  // Accepts either a single free-form query or an array of identifiers
  query: z
    .string()
    .describe(
      "A single piece of information about the contact (e.g., 'james.wilson@example.com', 'James Wilson', etc.)"
    ),
  limit: z
    .preprocess(
      (val) => (val === null || val === undefined ? undefined : val),
      z.number().int().positive().max(50).optional(),
    )
    .describe("Optional. Max number of matches to return (default determined by server)."),
});

const createInteractionSchema = z.object({
  contactQuery: z
    .string()
    .describe(
      "Information to identify the contact (e.g., name, email, company)."
    ),
  title: z.string().describe("A short title for the interaction."),
  notes: z.string().optional().describe("Optional notes about the interaction."),
  interactionType: z
    .string()
    .describe("The type of interaction (e.g., meeting, call, email)."),
  tags: z
    .array(z.string())
    .optional()
    .describe("Optional array of tag IDs associated with the interaction."),
  itemsDiscussed: z
    .array(z.string())
    .optional()
    .describe("Optional list of items discussed."),
  location: z.string().optional().describe("Where the interaction took place."),
  dateTime: z
    .number()
    .describe("Unix timestamp in milliseconds when the interaction occurred."),
  duration: z
    .number()
    .optional()
    .describe("Duration of the interaction in minutes."),
  followUpRequired: z
    .boolean()
    .optional()
    .describe("Whether a follow-up is required."),
  followUpDate: z
    .number()
    .optional()
    .describe("Unix timestamp for when follow-up should occur."),
});

const updateInteractionSchema = z.object({
  id: z.string().describe("The unique ID of the interaction to update."),
  title: z.string().describe("A short title for the interaction."),
  notes: z.string().optional().describe("Optional notes about the interaction."),
  interactionType: z
    .string()
    .describe("The type of interaction (e.g., meeting, call, email)."),
  tags: z
    .array(z.string())
    .optional()
    .describe("Optional array of tag IDs associated with the interaction."),
  itemsDiscussed: z
    .array(z.string())
    .optional()
    .describe("Optional list of items discussed."),
  location: z.string().optional().describe("Where the interaction took place."),
  dateTime: z
    .number()
    .describe("Unix timestamp in milliseconds when the interaction occurred."),
  duration: z
    .number()
    .optional()
    .describe("Duration of the interaction in minutes."),
  followUpRequired: z
    .boolean()
    .optional()
    .describe("Whether a follow-up is required."),
  followUpDate: z
    .number()
    .optional()
    .describe("Unix timestamp for when follow-up should occur."),
});

// This factory function injects the user's auth token into the tools
export const convexTools = (convexToken: string, env: ConvexToolsEnv) => {
  console.log("[CONVEX-TOOLS] Initializing convex tools factory");
  console.log("[CONVEX-TOOLS] Auth token provided:", !!convexToken);

  try {
    // Create a new Convex client instance for each request
    const convexUrl = env?.PUBLIC_CONVEX_URL;
    console.log("[CONVEX-TOOLS] Convex URL:", convexUrl);

    if (!convexUrl) {
      const error = new Error(
        "PUBLIC_CONVEX_URL environment variable is not set",
      );
      console.error(
        "[CONVEX-TOOLS] ERROR: Missing PUBLIC_CONVEX_URL environment variable",
      );
      throw error;
    }

    console.log(
      "[CONVEX-TOOLS] Creating ConvexHttpClient with URL:",
      convexUrl,
    );
    const convex = new ConvexHttpClient(convexUrl);

    // Set the auth token for all subsequent requests
    console.log("[CONVEX-TOOLS] Setting auth token for Convex client");
    convex.setAuth(convexToken);
    console.log("[CONVEX-TOOLS] Convex client initialized successfully");

    return {
      // --- READ / SEARCH ---
      listContacts: tool({
        description:
          "Get a list of all of the user's contacts. Use this for general queries like 'show me my contacts'.",
        inputSchema: listContactsSchema,
        execute: async ({ limit }) => {
          console.log("[CONVEX-TOOLS] listContacts: Starting execution");
          console.log(
            "[CONVEX-TOOLS] listContacts: Parameters - limit:",
            limit,
          );

          try {
            console.log(
              "[CONVEX-TOOLS] listContacts: Calling convex.query for getContacts",
            );
            const contacts = await convex.query(api.contacts.getContacts, {
              limit,
            }) as Contact[];
            
            console.log(
              "[CONVEX-TOOLS] listContacts: Successfully retrieved",
              contacts?.length || 0,
              "contacts",
            );
            return { 
              success: true, 
              contacts, 
              data: contacts 
            };
          } catch (error) {
            console.error(
              "[CONVEX-TOOLS] listContacts: ERROR occurred:",
              error,
            );
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return { 
              success: false, 
              error: errorMessage 
            };
          }
        },
      }),

      getContactById: tool({
        description:
          "Get a single, specific contact by their unique ID. Use this when you already have the ID.",
        inputSchema: getContactByIdSchema,
        execute: async ({ id }) => {
          console.log("[CONVEX-TOOLS] getContactById: Starting execution");
          console.log("[CONVEX-TOOLS] getContactById: Parameters - id:", id);

          if (!id || typeof id !== "string") {
            console.error(
              "[CONVEX-TOOLS] getContactById: ERROR - Invalid ID provided:",
              id,
            );
            return { 
              success: false, 
              error: "Invalid contact ID provided." 
            };
          }

          try {
            console.log(
              "[CONVEX-TOOLS] getContactById: Calling convex.query for getContactById",
            );
            const contact = await convex.query(api.contacts.getContactById, {
              id,
            }) as Contact | null;

            if (!contact) {
              console.log(
                "[CONVEX-TOOLS] getContactById: Contact not found for ID:",
                id,
              );
              return { 
                success: false, 
                error: "Contact not found." 
              };
            }

            console.log(
              "[CONVEX-TOOLS] getContactById: Successfully retrieved contact:",
              contact.name || "unnamed",
            );
            return { 
              success: true, 
              contact, 
              data: contact 
            };
          } catch (error) {
            console.error(
              "[CONVEX-TOOLS] getContactById: ERROR occurred:",
              error,
            );
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return { 
              success: false, 
              error: errorMessage 
            };
          }
        },
      }),

      // Utility: Resolve contact IDs from arbitrary info
      resolveContactIds: tool({
        description:
          "Resolve contact IDs from any information. Only provide one query string for the contacts (e.g., 'james.wilson@example.com', 'James Wilson', etc.). Use this BEFORE any tool that requires a contact ID so the user is never asked to provide raw IDs.",
        inputSchema: resolveContactIdsSchema,
        execute: async ({ query, limit }) => {
          console.log("[CONVEX-TOOLS] resolveContactIds: Starting execution");
          console.log("[CONVEX-TOOLS] resolveContactIds: Parameters:", {
            query,
            limit,
          });

          if (!query || typeof query !== "string" || query.trim() === "") {
            return {
              success: false,
              error:
                "Please provide a query.",
            };
          }

          const numericLimit: number | undefined =
            typeof limit === "number" && Number.isFinite(limit) && limit > 0
              ? limit
              : undefined;

          try {
            const results = (await convex.query(
              api.contacts.searchContacts,
              { searchQuery: query },
            )) as Contact[];

            const uniqueIds = new Set<string>();
            const uniqueMatches: Contact[] = [];
            for (const c of results) {
              if (!uniqueIds.has(c._id)) {
                uniqueIds.add(c._id);
                uniqueMatches.push(c);
              }
            }

            const finalMatches = numericLimit
              ? uniqueMatches.slice(0, numericLimit)
              : uniqueMatches;
            const ids = finalMatches.map((c) => c._id);

            console.log(
              "[CONVEX-TOOLS] resolveContactIds: Resolved",
              ids.length,
              "id(s) via single search",
            );
            return {
              success: true,
              ids,
              matches: finalMatches,
              data: { ids, matches: finalMatches },
            };
          } catch (error) {
            console.error(
              "[CONVEX-TOOLS] resolveContactIds: ERROR occurred:",
              error,
            );
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error occurred";
            return { success: false, error: errorMessage };
          }
        },
      }),

      searchContacts: tool({
        description:
          "Search for contacts using a query string. Use this for specific searches like 'find John Doe' or 'contacts at Acme Inc' or 'people I met at the conference'.",
        inputSchema: searchContactsSchema,
        execute: async ({ query }) => {
          console.log("[CONVEX-TOOLS] searchContacts: Starting execution");
          console.log(
            "[CONVEX-TOOLS] searchContacts: Parameters - query:",
            query,
          );

          if (
            !query ||
            typeof query !== "string" ||
            query.trim().length === 0
          ) {
            console.error(
              "[CONVEX-TOOLS] searchContacts: ERROR - Invalid or empty query provided:",
              query,
            );
            return { 
              success: false, 
              error: "Search query cannot be empty." 
            };
          }

          try {
            console.log(
              "[CONVEX-TOOLS] searchContacts: Calling convex.query for searchContacts",
            );
            const results = await convex.query(api.contacts.searchContacts, {
              searchQuery: query,
            }) as Contact[];
            
            console.log(
              "[CONVEX-TOOLS] searchContacts: Successfully found",
              results?.length || 0,
              "matching contacts",
            );
            console.log("[CONVEX-TOOLS] searchContacts: Results:", results);
            return { 
              success: true, 
              results, 
              data: results 
            };
          } catch (error) {
            console.error(
              "[CONVEX-TOOLS] searchContacts: ERROR occurred:",
              error,
            );
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return { 
              success: false, 
              error: errorMessage 
            };
          }
        },
      }),

      // --- CREATE ---
      createContact: tool({
        description:
          "Create a new contact for the user. The name is required. All other fields are optional.",
        inputSchema: createContactSchema,
        execute: async (params) => {
          console.log("[CONVEX-TOOLS] createContact: Starting execution");
          console.log(
            "[CONVEX-TOOLS] createContact: Parameters:",
            JSON.stringify(params, null, 2),
          );

          if (
            !params.name ||
            typeof params.name !== "string" ||
            params.name.trim().length === 0
          ) {
            console.error(
              "[CONVEX-TOOLS] createContact: ERROR - Invalid or missing name:",
              params.name,
            );
            return {
              success: false,
              error: "Contact name is required and cannot be empty.",
            };
          }

          // Validate email format if provided
          if (
            params.email &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.email)
          ) {
            console.error(
              "[CONVEX-TOOLS] createContact: ERROR - Invalid email format:",
              params.email,
            );
            return { 
              success: false, 
              error: "Invalid email format provided." 
            };
          }

          try {
            console.log(
              "[CONVEX-TOOLS] createContact: Calling convex.mutation for createContact",
            );
            const newContactId = await convex.mutation(
              api.contacts.createContact,
              params,
            ) as string;
            
            console.log(
              "[CONVEX-TOOLS] createContact: Successfully created contact with ID:",
              newContactId,
            );
            return {
              success: true,
              newContactId,
              message: "Contact created successfully.",
              data: { id: newContactId, ...params },
            };
          } catch (error) {
            console.error(
              "[CONVEX-TOOLS] createContact: ERROR occurred:",
              error,
            );
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return { 
              success: false, 
              error: errorMessage 
            };
          }
        },
      }),

      // --- UPDATE ---
      updateContact: tool({
        description:
          "Update one or more fields of an existing contact. You must provide the contact's ID.",
        inputSchema: updateContactSchema,
        execute: async (params) => {
          console.log("[CONVEX-TOOLS] updateContact: Starting execution");
          console.log(
            "[CONVEX-TOOLS] updateContact: Parameters:",
            JSON.stringify(params, null, 2),
          );

          if (!params.id || typeof params.id !== "string") {
            console.error(
              "[CONVEX-TOOLS] updateContact: ERROR - Invalid or missing contact ID:",
              params.id,
            );
            return {
              success: false,
              error: "Contact ID is required for updates.",
            };
          }

          // Check if at least one field to update is provided
          const updateFields = Object.keys(params).filter(
            (key) => key !== "id" && params[key as keyof typeof params] !== undefined,
          );
          if (updateFields.length === 0) {
            console.error(
              "[CONVEX-TOOLS] updateContact: ERROR - No fields provided for update",
            );
            return {
              success: false,
              error: "At least one field must be provided for update.",
            };
          }

          // Validate email format if provided
          if (
            params.email &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.email)
          ) {
            console.error(
              "[CONVEX-TOOLS] updateContact: ERROR - Invalid email format:",
              params.email,
            );
            return { 
              success: false, 
              error: "Invalid email format provided." 
            };
          }

          console.log(
            "[CONVEX-TOOLS] updateContact: Updating fields:",
            updateFields,
          );

          try {
            console.log(
              "[CONVEX-TOOLS] updateContact: Calling convex.mutation for updateContact",
            );
            await convex.mutation(api.contacts.updateContact, params);
            console.log(
              "[CONVEX-TOOLS] updateContact: Successfully updated contact with ID:",
              params.id,
            );
            return { 
              success: true, 
              message: "Contact updated successfully.",
              data: params,
            };
          } catch (error) {
            console.error(
              "[CONVEX-TOOLS] updateContact: ERROR occurred:",
              error,
            );
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return { 
              success: false, 
              error: errorMessage 
            };
          }
        },
      }),

      // --- DELETE ---
      deleteContact: tool({
        description: "Delete one or more contacts using their unique IDs or unique identifiers (like email). If an email or name is provided, it will be resolved to an ID first.",
        inputSchema: deleteContactSchema,
        execute: async ({ contactIds }) => {
          console.log("[CONVEX-TOOLS] deleteContact: Starting execution");
          console.log(
            "[CONVEX-TOOLS] deleteContact: Parameters - contactIds:",
            contactIds,
          );

          if (
            !contactIds ||
            !Array.isArray(contactIds) ||
            contactIds.length === 0
          ) {
            console.error(
              "[CONVEX-TOOLS] deleteContact: ERROR - Invalid or empty contactIds array:",
              contactIds,
            );
            return {
              success: false,
              error: "At least one contact ID must be provided for deletion.",
            };
          }

          // Validate all IDs are strings
          const invalidIds = contactIds.filter(
            (id) => !id || typeof id !== "string",
          );
          if (invalidIds.length > 0) {
            console.error(
              "[CONVEX-TOOLS] deleteContact: ERROR - Invalid contact IDs found:",
              invalidIds,
            );
            return {
              success: false,
              error: "All contact IDs must be valid strings.",
            };
          }

          // Resolve any non-ID identifiers (like emails or names) to actual contact IDs
          // Strategy:
          // - If a string contains '@', treat it as an email and search for exact email match
          // - Otherwise, attempt an exact name match only if it results in a single contact
          // - If a string looks like an ID (we can't be certain), pass it through
          const resolvedIds: string[] = [];
          for (const ident of contactIds) {
            try {
              if (typeof ident !== 'string') continue;
              const s = ident.trim();
              if (s.includes('@')) {
                // Likely an email
                const results = (await convex.query(api.contacts.searchContacts, {
                  searchQuery: s,
                })) as Contact[];
                const exact = results.filter(
                  (c) => c.email && c.email.toLowerCase() === s.toLowerCase(),
                );
                if (exact.length === 1) {
                  resolvedIds.push(exact[0]._id);
                  continue;
                } else if (exact.length > 1) {
                  return {
                    success: false,
                    error:
                      `Multiple contacts found with email ${s}. Please specify the contact ID instead.`,
                  };
                } else {
                  // No exact match; fall back to first result if unambiguous
                  if (results.length === 1) {
                    resolvedIds.push(results[0]._id);
                    continue;
                  }
                  return {
                    success: false,
                    error: `No contact found for email ${s}.`,
                  };
                }
              } else {
                // Try resolving by exact name if unique
                const results = (await convex.query(api.contacts.searchContacts, {
                  searchQuery: s,
                })) as Contact[];
                const exactByName = results.filter(
                  (c) => c.name && c.name.toLowerCase() === s.toLowerCase(),
                );
                if (exactByName.length === 1) {
                  resolvedIds.push(exactByName[0]._id);
                  continue;
                }
                // If not uniquely resolved by name, assume it is already an ID and pass through
                resolvedIds.push(s);
              }
            } catch (resolveErr) {
              console.log(
                "[CONVEX-TOOLS] deleteContact: Identifier resolution failed, passing through as ID:",
                ident,
                resolveErr,
              );
              resolvedIds.push(String(ident));
            }
          }

          console.log(
            "[CONVEX-TOOLS] deleteContact: Attempting to delete",
            resolvedIds.length,
            "contact(s) with IDs:",
            resolvedIds,
          );

          try {
            console.log(
              "[CONVEX-TOOLS] deleteContact: Calling convex.mutation for deleteContact",
            );
            await convex.mutation(api.contacts.deleteContact, { contactIds: resolvedIds });
            console.log(
              "[CONVEX-TOOLS] deleteContact: Successfully deleted",
              resolvedIds.length,
              "contact(s)",
            );
            return {
              success: true,
              message: `Successfully deleted ${resolvedIds.length} contact(s).`,
              data: { deletedIds: resolvedIds, count: resolvedIds.length },
            };
          } catch (error) {
            console.error(
              "[CONVEX-TOOLS] deleteContact: ERROR occurred:",
              error,
            );
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return {
              success: false,
              error: errorMessage,
            };
          }
        },
      }),

      createInteraction: tool({
        description:
          "Log an interaction with a contact identified by name, email, or other information.",
        inputSchema: createInteractionSchema,
        execute: async (params) => {
          console.log("[CONVEX-TOOLS] createInteraction: Starting execution");
          console.log(
            "[CONVEX-TOOLS] createInteraction: Parameters:",
            params,
          );

          try {
            const result = await convex.mutation(
              api.contactHistory.createContactHistoryByQuery,
              params as any,
            );
            console.log(
              "[CONVEX-TOOLS] createInteraction: Result from mutation:",
              result,
            );
            return { success: true, result, data: result };
          } catch (error) {
            console.error(
              "[CONVEX-TOOLS] createInteraction: ERROR occurred:",
              error,
            );
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error occurred";
            return { success: false, error: errorMessage };
          }
        },
      }),

      updateInteraction: tool({
        description: "Update an existing interaction by its ID.",
        inputSchema: updateInteractionSchema,
        execute: async (params) => {
          console.log("[CONVEX-TOOLS] updateInteraction: Starting execution");
          console.log(
            "[CONVEX-TOOLS] updateInteraction: Parameters:",
            params,
          );

          try {
            const result = await convex.mutation(
              api.contactHistory.updateContactHistory,
              params as any,
            );
            console.log(
              "[CONVEX-TOOLS] updateInteraction: Result from mutation:",
              result,
            );
            return { success: true, result, data: result };
          } catch (error) {
            console.error(
              "[CONVEX-TOOLS] updateInteraction: ERROR occurred:",
              error,
            );
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error occurred";
            return { success: false, error: errorMessage };
          }
        },
      }),

      // --- TAGS: CRUD ---
      listTags: tool({
description: "List all tags for the authenticated user.",
inputSchema: z.object({}),
execute: async () => {
try {
  const tags = await convex.query(api.tags.getTags, {});
  return { success: true, tags, data: tags };
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  return { success: false, error: errorMessage };
}
},
}),

createTag: tool({
description: "Create a new tag with a name and optional color.",
inputSchema: z.object({
  name: z.string().min(1, 'Tag name is required'),
  color: z.string().optional(),
}),
execute: async ({ name, color }) => {
try {
  const id = await convex.mutation(api.tags.createTag, { name, color });
  return { success: true, id, data: { id, name, color } };
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  return { success: false, error: errorMessage };
}
},
}),

updateTag: tool({
description: "Update an existing tag's name and color.",
inputSchema: z.object({ id: z.string(), name: z.string(), color: z.string() }),
execute: async ({ id, name, color }) => {
try {
  await convex.mutation(api.tags.updateTag, { id, name, color });
  return { success: true, data: { id, name, color } };
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  return { success: false, error: errorMessage };
}
},
}),

deleteTag: tool({
description: "Delete a tag by ID. This will also remove the tag from any contacts that use it.",
inputSchema: z.object({ id: z.string() }),
execute: async ({ id }) => {
try {
  await convex.mutation(api.tags.deleteTag, { id });
  return { success: true, data: { id } };
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  return { success: false, error: errorMessage };
}
},
}),

getTagById: tool({
description: "Get a single tag by ID.",
inputSchema: z.object({ id: z.string() }),
execute: async ({ id }) => {
try {
  const tag = await convex.query(api.tags.getTagById, { id });
  if (!tag) return { success: false, error: 'Tag not found' };
  return { success: true, tag, data: tag };
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  return { success: false, error: errorMessage };
}
},
}),

getTagsByIds: tool({
description: "Resolve multiple tag IDs to tag objects.",
inputSchema: z.object({ tagIds: z.array(z.string()).min(1) }),
execute: async ({ tagIds }) => {
try {
  const tags = await convex.query(api.tags.getTagsByIds, { tagIds });
  return { success: true, tags, data: tags };
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  return { success: false, error: errorMessage };
}
},
}),

// --- TAGS: Contact association helpers ---
getContactTags: tool({
description: "Get the full tag objects associated with a contact.",
inputSchema: z.object({ contactId: z.string() }),
execute: async ({ contactId }) => {
try {
  const contact = await convex.query(api.contacts.getContactById, { id: contactId });
  if (!contact) return { success: false, error: 'Contact not found' };
  const tagIds = Array.isArray((contact as any).tags) ? (contact as any).tags : [];
  if (tagIds.length === 0) return { success: true, tags: [], data: [] };
  const tags = await convex.query(api.tags.getTagsByIds, { tagIds });
  return { success: true, tags, data: tags };
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  return { success: false, error: errorMessage };
}
},
}),

addTagsToContact: tool({
description: "Add one or more tag IDs to a contact (merging with any existing tags).",
inputSchema: modifyContactTagsSchema,
execute: async ({ contactId, tagIds }) => {
try {
  const contact = await convex.query(api.contacts.getContactById, { id: contactId });
  if (!contact) return { success: false, error: 'Contact not found' };
  const current = Array.isArray((contact as any).tags) ? (contact as any).tags as string[] : [];
  const merged = Array.from(new Set([...current, ...tagIds]));
  await convex.mutation(api.contacts.updateContact, { id: contactId, tags: merged });
  return { success: true, data: { contactId, tags: merged } };
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  return { success: false, error: errorMessage };
}
},
}),

removeTagsFromContact: tool({
description: "Remove one or more tag IDs from a contact.",
inputSchema: modifyContactTagsSchema,
execute: async ({ contactId, tagIds }) => {
try {
  const contact = await convex.query(api.contacts.getContactById, { id: contactId });
  if (!contact) return { success: false, error: 'Contact not found' };
  const current = Array.isArray((contact as any).tags) ? (contact as any).tags as string[] : [];
  const updated = current.filter((t) => !tagIds.includes(t));
  await convex.mutation(api.contacts.updateContact, { id: contactId, tags: updated });
  return { success: true, data: { contactId, tags: updated } };
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  return { success: false, error: errorMessage };
}
},
}),
};
} catch (error) {
console.error(
  "[CONVEX-TOOLS] FATAL ERROR initializing convex tools:",
  error,
);
throw error;
}
};