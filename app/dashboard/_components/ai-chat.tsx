"use client";

//* Components Imports
import { AiChatPanel } from "./ai-chat-panel";

//* Hooks Imports
import { useAiSettings } from "@/hooks/use-ai-settings";

export function AiChat() {
  const { userId, isLoading } = useAiSettings();
  if (isLoading || !userId) return null;
  return <AiChatPanel key={userId} />;
}
