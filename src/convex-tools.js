// convex-tools.js
import { tool } from "ai";
import { z } from "zod";
import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api";

// This factory function injects the user's auth token into the tools
export const convexTools = (convexToken, env) => {
  // Create a new Convex client instance for each request
  const convexUrl = env?.PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error('PUBLIC_CONVEX_URL environment variable is not set');
  }

  const convex = new ConvexHttpClient(convexUrl);
  // Set the auth token for all subsequent requests
  convex.setAuth(convexToken);

  return {
    // --- READ / SEARCH ---
    listContacts: tool({
      description: "Get a list of all of the user's contacts. Use this for general queries like 'show me my contacts'.",
      parameters: z.object({
        limit: z.number().optional().describe("Optional. Maximum number of contacts to retrieve."),
      }),
      execute: async ({ limit }) => {
        try {
          const contacts = await convex.query(api.contacts.getContacts, { limit });
          return { success: true, contacts };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
    }),

    getContactById: tool({
      description: "Get a single, specific contact by their unique ID. Use this when you already have the ID.",
      parameters: z.object({
        id: z.string().describe("The unique ID of the contact to retrieve."),
      }),
      execute: async ({ id }) => {
        try {
          const contact = await convex.query(api.contacts.getContactById, { id });
          if (!contact) return { success: false, error: "Contact not found." };
          return { success: true, contact };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
    }),

    searchContacts: tool({
      description: "Search for contacts using a query string. Use this for specific searches like 'find John Doe' or 'contacts at Acme Inc' or 'people I met at the conference'.",
      parameters: z.object({
        query: z.string().describe("The search term. Can be a name, email, company, job title, or content from notes."),
      }),
      execute: async ({ query }) => {
        try {
          const results = await convex.query(api.contacts.searchContacts, { searchQuery: query });
          return { success: true, results };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
    }),

    // --- CREATE ---
    createContact: tool({
      description: "Create a new contact for the user. The name is required. All other fields are optional.",
      parameters: z.object({
        name: z.string().describe("The full name of the contact."),
        email: z.string().optional().describe("The contact's email address."),
        phone: z.string().optional().describe("The contact's phone number."),
        jobTitle: z.string().optional().describe("The contact's job title."),
        company: z.string().optional().describe("The company the contact works for."),
        location: z.string().optional().describe("The city or country of the contact."),
        linkedin: z.string().optional().describe("A URL to the contact's LinkedIn profile."),
        notes: z.string().optional().describe("Any notes about the contact."),
      }),
      execute: async (params) => {
        try {
          const newContactId = await convex.mutation(api.contacts.createContact, params);
          return { success: true, newContactId, message: "Contact created successfully." };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
    }),

    // --- UPDATE ---
    updateContact: tool({
      description: "Update one or more fields of an existing contact. You must provide the contact's ID.",
      parameters: z.object({
        id: z.string().describe("The unique ID of the contact to update."),
        name: z.string().optional().describe("The new full name of the contact."),
        email: z.string().optional().describe("The new email address."),
        phone: z.string().optional().describe("The new phone number."),
        jobTitle: z.string().optional().describe("The new job title."),
        company: z.string().optional().describe("The new company."),
        location: z.string().optional().describe("The new location."),
        linkedin: z.string().optional().describe("The new LinkedIn profile URL."),
        notes: z.string().optional().describe("Updated notes for the contact."),
      }),
      execute: async (params) => {
        try {
          await convex.mutation(api.contacts.updateContact, params);
          return { success: true, message: "Contact updated successfully." };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
    }),

    // --- DELETE ---
    deleteContact: tool({
      description: "Delete one or more contacts using their unique IDs.",
      parameters: z.object({
        contactIds: z.array(z.string()).describe("An array of contact IDs to be deleted."),
      }),
      execute: async ({ contactIds }) => {
        try {
          await convex.mutation(api.contacts.deleteContact, { contactIds });
          return { success: true, message: `Successfully deleted ${contactIds.length} contact(s).` };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
    }),
  };
};