import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const User = {
  email: v.string(),
  externalId: v.string(),
  imageUrl: v.optional(v.string()),
  name: v.optional(v.string()),
};

export const Contact = {
  userId: v.id("users"),
  name: v.optional(v.string()),
  avatar: v.optional(v.id("_storage")),
  avatarUrl: v.optional(v.string()),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  jobTitle: v.optional(v.string()),
  company: v.optional(v.string()),
  location: v.optional(v.string()),
  linkedin: v.optional(v.string()),
  notes: v.optional(v.string()),
  tags: v.optional(v.array(v.id("tags"))),
  lastContact: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
  searchSummary: v.optional(v.string()),
};

export const Tag = {
  userId: v.id("users"),
  name: v.string(),
  color: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
};

export const ContactHistory = {
  contactId: v.id("contacts"),
  userId: v.id("users"),
  title: v.string(),
  notes: v.optional(v.string()),
  interactionType: v.string(), // 'call', 'email', 'meeting', 'text', 'social', 'other'
  tags: v.optional(v.array(v.string())), // Different from contact tags - these are interaction-specific
  itemsDiscussed: v.optional(v.array(v.string())),
  location: v.optional(v.string()),
  dateTime: v.number(),
  duration: v.optional(v.number()), // Duration in minutes
  followUpRequired: v.optional(v.boolean()),
  followUpDate: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
};

export default defineSchema({
  users: defineTable(User).index("externalId", ["externalId"]),

  tags: defineTable(Tag)
    .index("userId", ["userId"])
    .index("userId_name", ["userId", "name"]),

  contacts: defineTable(Contact)
    .index("userId", ["userId"])
    .index("email", ["email"])
    .searchIndex("search_summary", {
      searchField: "searchSummary",
      filterFields: [
        "name",
        "location",
        "jobTitle",
        "company",
        "phone",
        "email",
        "linkedin",
        "notes",
        "createdAt",
        "updatedAt",
        "userId",
      ],
    }),

  contactHistory: defineTable(ContactHistory)
    .index("contactId", ["contactId"])
    .index("userId", ["userId"])
    .index("contactId_dateTime", ["contactId", "dateTime"])
    .index("dateTime", ["dateTime"])
    .index("userId_dateTime", ["userId", "dateTime"]),
});
