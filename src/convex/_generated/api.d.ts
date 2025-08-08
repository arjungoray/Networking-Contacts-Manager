/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as auth from "../auth.js";
import type * as chats from "../chats.js";
import type * as contactHistory from "../contactHistory.js";
import type * as contactSearch from "../contactSearch.js";
import type * as contacts from "../contacts.js";
import type * as http from "../http.js";
import type * as messages from "../messages.js";
import type * as settings from "../settings.js";
import type * as tags from "../tags.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  chats: typeof chats;
  contactHistory: typeof contactHistory;
  contactSearch: typeof contactSearch;
  contacts: typeof contacts;
  http: typeof http;
  messages: typeof messages;
  settings: typeof settings;
  tags: typeof tags;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
