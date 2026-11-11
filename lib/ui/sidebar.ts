/**
 * Cookie that remembers a collapsed sidebar. It lives outside the "use client"
 * shell on purpose: a server component importing a plain value from a client
 * module gets a client reference, not the string.
 */
export const SIDEBAR_COOKIE = "flawment-sidebar";
