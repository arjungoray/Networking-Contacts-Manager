import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { getUser } from "./auth";

// Predefined tag colors
const TAG_COLORS = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#96CEB4", // Green
  "#FFEAA7", // Yellow
  "#DDA0DD", // Plum
  "#98D8C8", // Mint
  "#F7DC6F", // Light Yellow
  "#BB8FCE", // Light Purple
  "#85C1E9", // Light Blue
  "#F8C471", // Orange
  "#82E0AA", // Light Green
];

export const createTag = mutation({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);

    // Check if tag with this name already exists for this user
    const existingTag = await ctx.db
      .query("tags")
      .withIndex("userId_name", (q) =>
        q.eq("userId", (user as any)._id).eq("name", args.name),
      )
      .first();

    if (existingTag) {
      throw new Error("Tag with this name already exists");
    }

    // Assign a random color if none provided
    const color =
      args.color || TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];

    return await ctx.db.insert("tags", {
      userId: (user as any)._id,
      name: args.name,
      color: color,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const getTags = query({
  handler: async (ctx) => {
    const user = await getUser(ctx);
    return await ctx.db
      .query("tags")
      .withIndex("userId", (q) => q.eq("userId", (user as any)._id))
      .collect();
  },
});

export const getTagById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const tag = await ctx.db.get(args.id as Id<"tags">);

    // Ensure the tag belongs to the current user
    if (tag && tag.userId === (user as any)._id) {
      return tag;
    }

    return null;
  },
});

export const updateTag = mutation({
  args: {
    id: v.string(),
    name: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const tag = await ctx.db.get(args.id as Id<"tags">);

    if (!tag || tag.userId !== (user as any)._id) {
      throw new Error("Tag not found or access denied");
    }

    // Check if another tag with this name already exists for this user
    const existingTag = await ctx.db
      .query("tags")
      .withIndex("userId_name", (q) =>
        q.eq("userId", (user as any)._id).eq("name", args.name),
      )
      .first();

    if (existingTag && existingTag._id !== args.id) {
      throw new Error("Tag with this name already exists");
    }

    return await ctx.db.patch(args.id as Id<"tags">, {
      name: args.name,
      color: args.color,
      updatedAt: Date.now(),
    });
  },
});

export const deleteTag = mutation({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const tag = await ctx.db.get(args.id as Id<"tags">);

    if (!tag || tag.userId !== (user as any)._id) {
      throw new Error("Tag not found or access denied");
    }

    // Remove this tag from all contacts that use it
    const contactsWithTag = await ctx.db
      .query("contacts")
      .withIndex("userId", (q) => q.eq("userId", (user as any)._id))
      .collect();

    for (const contact of contactsWithTag) {
      if (contact.tags && contact.tags.includes(args.id as Id<"tags">)) {
        const updatedTags = contact.tags.filter((tagId) => tagId !== args.id);
        await ctx.db.patch(contact._id, {
          tags: updatedTags,
          updatedAt: Date.now(),
        });
      }
    }

    return await ctx.db.delete(args.id as Id<"tags">);
  },
});

export const getTagsByIds = query({
  args: { tagIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const tags = [];

    for (const tagId of args.tagIds) {
      // Validate that the tagId is a proper Convex ID before using it
      try {
        const tag = await ctx.db.get(tagId as Id<"tags">);
        if (tag && tag.userId === (user as any)._id) {
          tags.push(tag);
        }
      } catch (error) {
        // Skip invalid IDs rather than throwing an error
        console.warn(`Invalid tag ID skipped: ${tagId}`);
        continue;
      }
    }

    return tags;
  },
});
