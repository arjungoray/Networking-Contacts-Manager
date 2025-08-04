import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, query } from './_generated/server';
import { getUser } from './auth';

export const createContactHistory = mutation({
    args: {
        contactId: v.string(),
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
        const contact = await ctx.db.get(args.contactId as Id<"contacts">);
        if (!contact || contact.userId !== (user as any)._id) {
            throw new Error("Contact not found or access denied");
        }

        const historyId = await ctx.db.insert('contactHistory', {
            contactId: args.contactId as Id<"contacts">,
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
        await ctx.db.patch(args.contactId as Id<"contacts">, {
            lastContact: args.dateTime,
            updatedAt: Date.now(),
        });

        return historyId;
    },
});

export const getContactHistory = query({
    args: { contactId: v.string() },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);
        
        // Verify the contact belongs to the user
        const contact = await ctx.db.get(args.contactId as Id<"contacts">);
        if (!contact || contact.userId !== (user as any)._id) {
            throw new Error("Contact not found or access denied");
        }

        return await ctx.db.query('contactHistory')
            .withIndex('contactId_dateTime', (q) => q.eq('contactId', args.contactId as Id<"contacts">))
            .order('desc')
            .collect();
    },
});

export const getContactHistoryById = query({
    args: { id: v.string() },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);
        const history = await ctx.db.get(args.id as Id<"contactHistory">);
        
        // Ensure the history belongs to the current user
        if (history && history.userId === (user as any)._id) {
            return history;
        }
        
        return null;
    },
});

export const updateContactHistory = mutation({
    args: {
        id: v.string(),
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
        const history = await ctx.db.get(args.id as Id<"contactHistory">);

        // Ensure the history exists and belongs to the current user
        if (!history || history.userId !== (user as any)._id) {
            throw new Error("Contact history not found or access denied");
        }

        return await ctx.db.patch(args.id as Id<"contactHistory">, {
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
        historyIds: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);
        
        for (const historyId of args.historyIds) {
            const history = await ctx.db.get(historyId as Id<"contactHistory">);
            if (history && history.userId === (user as any)._id) {
                await ctx.db.delete(historyId as Id<"contactHistory">);
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
    args: { contactId: v.string() },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);
        
        // Verify the contact belongs to the user
        const contact = await ctx.db.get(args.contactId as Id<"contacts">);
        if (!contact || contact.userId !== (user as any)._id) {
            throw new Error("Contact not found or access denied");
        }

        const allHistory = await ctx.db.query('contactHistory')
            .withIndex('contactId', (q) => q.eq('contactId', args.contactId as Id<"contacts">))
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
