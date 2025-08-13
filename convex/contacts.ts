// convex/contacts.ts
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, query } from './_generated/server';
import { getUser } from './auth';

// ... (uploadAvatar, avatarUrlFromId, generatedUploadUrl functions remain the same)

export const uploadAvatar = mutation({
    args: {
        file: v.id("_storage"),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);
        return await ctx.db.patch(  (user as any)._id, {
            avatar: args.file,
        });
    },
});

export const avatarUrlFromId = mutation({
    args: {
        id: v.id("_storage"),
    },
    handler: async (ctx, args) => {
        return await ctx.storage.getUrl(args.id);
    }
})


export const generatedUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        return await ctx.storage.generateUploadUrl();
    }
})


export const createContact = mutation({
    args: {
        email: v.optional(v.string()),
        emails: v.optional(v.array(v.string())),
        name: v.string(),
        phone: v.optional(v.string()),
        phones: v.optional(v.array(v.string())),
        avatar: v.optional(v.id("_storage")),
        avatarUrl: v.optional(v.string()),
        jobTitle: v.optional(v.string()),
        company: v.optional(v.string()),
        location: v.optional(v.string()),
        linkedin: v.optional(v.string()),
        notes: v.optional(v.string()),
        tags: v.optional(v.array(v.id("tags"))),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);
        const userId = (user as any)._id;

        // Normalize legacy single fields to arrays for storage/search
        const primaryEmail = args.email ?? (args.emails && args.emails[0]) ?? undefined;
        const primaryPhone = args.phone ?? (args.phones && args.phones[0]) ?? undefined;

        // Build search summary including all emails/phones, company and tag names
        let searchSummary = `${args.name || ''} ${primaryEmail || ''} ${primaryPhone || ''} ${(args.emails || []).join(' ')} ${(args.phones || []).join(' ')} ${args.jobTitle || ''} ${args.company || ''} ${args.location || ''} ${args.linkedin || ''} ${args.notes || ''}`;

        // Add tag names to search summary
        if (args.tags && args.tags.length > 0) {
            for (const tagId of args.tags) {
                const tag = await ctx.db.get(tagId);
                if (tag) {
                    searchSummary += ` ${tag.name}`;
                }
            }
        }

        return await ctx.db.insert('contacts', {
            userId: userId,
            avatar: args.avatar,
            avatarUrl: args.avatarUrl,
            email: primaryEmail,
            emails: args.emails,
            name: args.name,
            phone: primaryPhone,
            phones: args.phones,
            jobTitle: args.jobTitle,
            company: args.company,
            location: args.location,
            linkedin: args.linkedin,
            notes: args.notes,
            tags: args.tags,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            searchSummary: searchSummary,
        });
    },
});

export const getContacts = query({
    args: {
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);
        const query = ctx.db.query('contacts')
            .withIndex('userId', (q) => q.eq('userId', (user as any)._id))
            .order("desc"); // Show most recent first

        if (args.limit) {
            return await query.take(args.limit);
        }

        return await query.collect();
    },
});

export const getContactById = query({
    args: { id: v.string() },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);
        const contact = await ctx.db.get(args.id as Id<"contacts">);

        if (!contact || contact.userId !== (user as any)._id) {
            return null;
        }
        
        return contact;
    },
});

// MODIFIED: Made name optional for flexible partial updates
export const updateContact = mutation({
    args: {
        id: v.string(),
        name: v.optional(v.string()),
        email: v.optional(v.string()),
        emails: v.optional(v.array(v.string())),
        phone: v.optional(v.string()),
        phones: v.optional(v.array(v.string())),
        jobTitle: v.optional(v.string()),
        company: v.optional(v.string()),
        location: v.optional(v.string()),
        linkedin: v.optional(v.string()),
        notes: v.optional(v.string()),
        avatar: v.optional(v.id("_storage")),
        avatarUrl: v.optional(v.string()),
        tags: v.optional(v.array(v.id("tags"))),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);
        const userId = (user as any)._id;
        const contactId = args.id as Id<"contacts">;

        const existingContact = await ctx.db.get(contactId);

        if (!existingContact || existingContact.userId !== userId) {
            throw new Error("Contact not found or access denied");
        }

        const { id, ...rest } = args;
        
        // Rebuild search summary with existing data as fallback
        const newSearchData: any = { ...existingContact, ...rest };
        // Keep legacy single fields aligned with arrays (first element as primary)
        if (rest.emails && rest.emails.length > 0) {
            newSearchData.email = rest.emails[0];
        }
        if (rest.phones && rest.phones.length > 0) {
            newSearchData.phone = rest.phones[0];
        }
        let searchSummary = `${newSearchData.name || ''} ${newSearchData.email || ''} ${newSearchData.phone || ''} ${((newSearchData.emails || []) as string[]).join(' ')} ${((newSearchData.phones || []) as string[]).join(' ')} ${newSearchData.jobTitle || ''} ${newSearchData.company || ''} ${newSearchData.location || ''} ${newSearchData.linkedin || ''} ${newSearchData.notes || ''}`;
        
        if (newSearchData.tags && newSearchData.tags.length > 0) {
                                                for (const tagId of newSearchData.tags) {
                                                        const tag = await ctx.db.get(tagId);
                                                        if (tag && tag._id && (tag._id as any).__tableName === "tags") {
                                                            searchSummary += ` ${(tag as { name: string }).name}`;
                                                        }
            }
        }

        await ctx.db.patch(contactId, {
            ...rest,
            ...(rest.emails ? { email: rest.emails[0] } : {}),
            ...(rest.phones ? { phone: rest.phones[0] } : {}),
            updatedAt: Date.now(),
            searchSummary: searchSummary
        });
    },
});

// MODIFIED: Added security check to ensure user owns contacts before deleting
export const deleteContact = mutation({
    args: {
        contactIds: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);
        const userId = (user as any)._id;

        for (const contactIdStr of args.contactIds) {
            const contactId = contactIdStr as Id<"contacts">;
            const contact = await ctx.db.get(contactId);

            if (contact && contact.userId === userId) {
                await ctx.db.delete(contactId);
            } else {
                // You can choose to throw an error or just silently ignore.
                // Throwing an error is generally better for providing feedback.
                throw new Error(`Access denied or contact not found for ID: ${contactIdStr}`);
            }
        }
        return { success: true };
    },
})

// ADDED: New function to perform full-text search on contacts
export const searchContacts = query({
    args: {
        searchQuery: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);
        if (!args.searchQuery) {
            return [];
        }
        return await ctx.db
            .query("contacts")
            .withSearchIndex("search_summary", (q) =>
                q.search("searchSummary", args.searchQuery)
                 .eq("userId", (user as any)._id)
            )
            .collect();
    }
});
