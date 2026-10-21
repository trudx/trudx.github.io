"use client";

//* Libraries Imports
import { createContext } from "react";

//* Types Imports
import type { AiSettings } from "./types";

export const AiContext = createContext<{
  userId: string | null;
  settings: AiSettings;
  isLoading: boolean;
  saveSettings: (settings: AiSettings) => void;
  clearSettings: () => void;
} | null>(null);
