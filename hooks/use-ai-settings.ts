"use client";

//* Libraries Imports
import { useContext } from "react";

//* Utils Imports
import { AiContext } from "@/lib/ai/context";

export function useAiSettings() {
  const context = useContext(AiContext);
  if (!context) throw new Error("Assistente fora do contexto de configurações.");
  return context;
}
