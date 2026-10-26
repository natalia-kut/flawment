"use client";

import { createContext } from "react";

// Template the Documents page should select when it opens, e.g. one Flawiusz just saved.
export const RequestedTemplateContext = createContext<string | null>(null);
