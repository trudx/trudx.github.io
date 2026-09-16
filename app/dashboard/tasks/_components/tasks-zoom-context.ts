"use client";

//* Libraries Imports
import { createContext, useContext } from "react";

//* Types Imports
import type { useDraggable } from "@dnd-kit/core";

type DndTransform = ReturnType<typeof useDraggable>["transform"];

/**
 * Escala do corpo da aba Tarefas (propriedade CSS `zoom`). O dnd-kit calcula deslocamentos em pixels
 * da tela, mas um `transform` aplicado dentro de um elemento com zoom é multiplicado pelo zoom — sem
 * compensar, o card/coluna arrastado andaria só 75% do que o mouse andou.
 */
export const TasksZoomContext = createContext(1);

export function useTasksZoomContext() {
  return useContext(TasksZoomContext);
}

export function toZoomedTranslate(transform: DndTransform, scale: number) {
  if (!transform) return undefined;
  return `translate3d(${transform.x / scale}px, ${transform.y / scale}px, 0)`;
}
