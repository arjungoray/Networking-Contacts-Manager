import { v } from "convex/values";
import { api } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";

// Add a message to a chat
export const addMessage = mutation({
  args: {
    chatId: v.id("chats"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    metadata: v.optional(v.object({
      toolsUsed: v.optional(v.array(v.string())),
      responseType: v.optional(v.string()),
      processingTime: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.runQuery(api.users.getUserByExternalId, {
      externalId: identity.subject,
    });
    
    if (!user) {
      throw new Error("User not found");
    }

    // Verify chat ownership
    const chat = await ctx.runQuery(api.chats.getChat, { chatId: args.chatId });
    if (!chat || chat.userId !== user._id) {
      throw new Error("Chat not found or access denied");
    }

    const now = Date.now();

    // Add the message
    const messageId: any = await ctx.db.insert("messages", {
      chatId: args.chatId,
      userId: user._id,
      role: args.role,
      content: args.content,
      metadata: args.metadata,
      createdAt: now,
    });

    // Update chat's updatedAt timestamp
    await ctx.db.patch(args.chatId, {
      updatedAt: now,
    });

    return messageId;
  },
});

// Get all messages for a chat
export const getChatMessages = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.runQuery(api.users.getUserByExternalId, {
      externalId: identity.subject,
    });
    
    if (!user) {
      throw new Error("User not found");
    }

    // Verify chat ownership
    const chat = await ctx.runQuery(api.chats.getChat, { chatId: args.chatId });
    if (!chat || chat.userId !== user._id) {
      throw new Error("Chat not found or access denied");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("chatId_createdAt", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .collect();

    return messages;
  },
});

// NOTE: sendMessage action removed - AI service requests are now handled client-side
// The client now makes direct requests to the AI service with Clerk authentication
// and uses the addMessage mutation to store both user and assistant messages

// Delete a specific message
export const deleteMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.runQuery(api.users.getUserByExternalId, {
      externalId: identity.subject,
    });
    
    if (!user) {
      throw new Error("User not found");
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Verify chat ownership
    const chat = await ctx.db.get(message.chatId);
    if (!chat || chat.userId !== user._id) {
      throw new Error("Chat not found or access denied");
    }

    await ctx.db.delete(args.messageId);
  },
});
