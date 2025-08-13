import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a new chat
export const createChat = mutation({
  args: {
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    const user = await ctx.db
      .query("users")
      .withIndex("externalId", (q) => q.eq("externalId", identity.subject))
      .unique();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    const now = Date.now();
    const title = args.title || `Chat ${new Date().toLocaleDateString()}`;

    const chatId = await ctx.db.insert("chats", {
      userId: user._id,
      title,
      createdAt: now,
      updatedAt: now,
      isArchived: false,
    });

    return chatId;
  },
});

// Get all chats for a user
export const getUserChats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("externalId", (q) => q.eq("externalId", identity.subject))
      .unique();
    
    if (!user) {
      throw new Error("User not found");
    }

    const chats = await ctx.db
      .query("chats")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .order("desc")
      .collect();

    return chats;
  },
});

// Get a specific chat
export const getChat = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    const user = await ctx.db
      .query("users")
      .withIndex("externalId", (q) => q.eq("externalId", identity.subject))
      .unique();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== user._id) {
      throw new Error("Chat not found or access denied");
    }

    return chat;
  },
});

// Update chat title
export const updateChatTitle = mutation({
  args: { chatId: v.id("chats"), title: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("externalId", (q) => q.eq("externalId", identity.subject))
      .unique();
    
    if (!user) {
      throw new Error("User not found");
    }

    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== user._id) {
      throw new Error("Chat not found or access denied");
    }

    await ctx.db.patch(args.chatId, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

// Archive/delete a chat
export const archiveChat = mutation({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("externalId", (q) => q.eq("externalId", identity.subject))
      .unique();
    
    if (!user) {
      throw new Error("User not found");
    }

    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== user._id) {
      throw new Error("Chat not found or access denied");
    }

    await ctx.db.patch(args.chatId, {
      isArchived: true,
      updatedAt: Date.now(),
    });
  },
});

// Permanently delete a chat and all its messages
export const deleteChat = mutation({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("externalId", (q) => q.eq("externalId", identity.subject))
      .unique();
    
    if (!user) {
      throw new Error("User not found");
    }

    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== user._id) {
      throw new Error("Chat not found or access denied");
    }

    // Delete all messages in the chat
    const messages = await ctx.db
      .query("messages")
      .withIndex("chatId", (q) => q.eq("chatId", args.chatId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete the chat
    await ctx.db.delete(args.chatId);
  },
});

// Clear all messages in a chat
export const clearChat = mutation({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("externalId", (q) => q.eq("externalId", identity.subject))
      .unique();
    
    if (!user) {
      throw new Error("User not found");
    }

    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== user._id) {
      throw new Error("Chat not found or access denied");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("chatId", (q) => q.eq("chatId", args.chatId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    await ctx.db.patch(args.chatId, {
      updatedAt: Date.now(),
    });
  },
});
