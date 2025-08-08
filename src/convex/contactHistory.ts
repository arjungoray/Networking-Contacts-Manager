import { v } from "convex/values";
import { mutation, query } from './_generated/server';
import { getUser } from './auth';

export const createContactHistory = mutation({
    args: {
        contactId: v.id("contacts"),
        title: v.string(),
        notes: v.optional(v.string()),
        interactionType: v.string(),
        tags: v.optional(v.array(v.string())),
        itemsDiscussed: v.optional(v.array(v.string())),
        location: v.optional(v.string()),
        dateTime: v.number(),
        duration: v.optional(v.number()),
        followUpRequired: v.optional(v.boolean()),
        followUpDate: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);
        
        // Verify the contact belongs to the user
        const contact = await ctx.db.get(args.contactId);
        if (!contact || contact.userId !== (user as any)._id) {
            throw new Error("Contact not found or access denied");
        }

        const historyId = await ctx.db.insert('contactHistory', {
            contactId: args.contactId,
            userId: (user as any)._id,
            title: args.title,
            notes: args.notes,
            interactionType: args.interactionType,
            tags: args.tags,
            itemsDiscussed: args.itemsDiscussed,
            location: args.location,
            dateTime: args.dateTime,
            duration: args.duration,
            followUpRequired: args.followUpRequired,
            followUpDate: args.followUpDate,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        // Update the contact's lastContact field
        await ctx.db.patch(args.contactId, {
            lastContact: args.dateTime,
            updatedAt: Date.now(),
        });

        return historyId;
    },
});

export const createContactHistoryByQuery = mutation({
    args: {
        contactQuery: v.string(),
        title: v.string(),
        notes: v.optional(v.string()),
        interactionType: v.string(),
        tags: v.optional(v.array(v.string())),
        itemsDiscussed: v.optional(v.array(v.string())),
        location: v.optional(v.string()),
        dateTime: v.number(),
        duration: v.optional(v.number()),
        followUpRequired: v.optional(v.boolean()),
        followUpDate: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);

        const matches = await ctx.db
            .query('contacts')
            .withSearchIndex('search_summary', (q) =>
                q.search('searchSummary', args.contactQuery).eq('userId', (user as any)._id)
            )
            .collect();

        if (matches.length === 0) {
            return { status: 'not_found' };
        }

        if (matches.length > 1) {
            return {
                status: 'ambiguous',
                matches: matches.map((c) => ({ _id: c._id, name: c.name, email: c.email })),
            };
        }

        const contactId = matches[0]._id;

        const historyId = await ctx.db.insert('contactHistory', {
            contactId,
            userId: (user as any)._id,
            title: args.title,
            notes: args.notes,
            interactionType: args.interactionType,
            tags: args.tags,
            itemsDiscussed: args.itemsDiscussed,
            location: args.location,
            dateTime: args.dateTime,
            duration: args.duration,
            followUpRequired: args.followUpRequired,
            followUpDate: args.followUpDate,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        await ctx.db.patch(contactId, {
            lastContact: args.dateTime,
            updatedAt: Date.now(),
        });

        return { status: 'success', historyId };
    },
});

export const getContactHistory = query({
    args: { contactId: v.id("contacts") },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);
        
        // Verify the contact belongs to the user
        const contact = await ctx.db.get(args.contactId);
        if (!contact || contact.userId !== (user as any)._id) {
            throw new Error("Contact not found or access denied");
        }

        return await ctx.db.query('contactHistory')
            .withIndex('contactId_dateTime', (q) => q.eq('contactId', args.contactId))
            .order('desc')
            .collect();
    },
});

export const getContactHistoryById = query({
    args: { id: v.id("contactHistory") },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);
        const history = await ctx.db.get(args.id);
        
        // Ensure the history belongs to the current user
        if (history && history.userId === (user as any)._id) {
            return history;
        }
        
        return null;
    },
});

export const updateContactHistory = mutation({
    args: {
        id: v.id("contactHistory"),
        title: v.string(),
        notes: v.optional(v.string()),
        interactionType: v.string(),
        tags: v.optional(v.array(v.string())),
        itemsDiscussed: v.optional(v.array(v.string())),
        location: v.optional(v.string()),
        dateTime: v.number(),
        duration: v.optional(v.number()),
        followUpRequired: v.optional(v.boolean()),
        followUpDate: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);
        const history = await ctx.db.get(args.id);

        // Ensure the history exists and belongs to the current user
        if (!history || history.userId !== (user as any)._id) {
            throw new Error("Contact history not found or access denied");
        }

        return await ctx.db.patch(args.id, {
            title: args.title,
            notes: args.notes,
            interactionType: args.interactionType,
            tags: args.tags,
            itemsDiscussed: args.itemsDiscussed,
            location: args.location,
            dateTime: args.dateTime,
            duration: args.duration,
            followUpRequired: args.followUpRequired,
            followUpDate: args.followUpDate,
            updatedAt: Date.now(),
        });
    },
});

export const deleteContactHistory = mutation({
    args: {
        historyIds: v.array(v.id("contactHistory")),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);
        
        for (const historyId of args.historyIds) {
            const history = await ctx.db.get(historyId);
            if (history && history.userId === (user as any)._id) {
                await ctx.db.delete(historyId);
            }
        }
        
        return true;
    },
});

export const getRecentContactHistory = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);
        const limit = args.limit || 10;
        
        return await ctx.db.query('contactHistory')
            .withIndex('userId_dateTime', (q) => q.eq('userId', (user as any)._id))
            .order('desc')
            .take(limit);
    },
});

export const getContactHistoryStats = query({
    args: { contactId: v.id("contacts") },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);
        
        // Verify the contact belongs to the user
        const contact = await ctx.db.get(args.contactId);
        if (!contact || contact.userId !== (user as any)._id) {
            throw new Error("Contact not found or access denied");
        }

        const allHistory = await ctx.db.query('contactHistory')
            .withIndex('contactId', (q) => q.eq('contactId', args.contactId))
            .collect();

        const totalInteractions = allHistory.length;
        const totalDuration = allHistory.reduce((sum, h) => sum + (h.duration || 0), 0);
        const lastInteraction = allHistory.length > 0 ? Math.max(...allHistory.map(h => h.dateTime)) : null;
        
        const interactionTypes = allHistory.reduce((acc, h) => {
            acc[h.interactionType] = (acc[h.interactionType] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return {
            totalInteractions,
            totalDuration,
            lastInteraction,
            interactionTypes,
        };
    },
});
