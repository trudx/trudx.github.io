"use client";

//* Libraries Imports
import { useCallback, useEffect, useRef, useState } from "react";

// Folga para arredondamento de subpixel (o zoom da aba Tarefas deixa `scrollLeft` fracionado).
const EDGE_TOLERANCE = 2;

function canScrollVertically(element: HTMLElement, deltaY: number) {
  const { overflowY } = getComputedStyle(element);
  if (overflowY !== "auto" && overflowY !== "scroll") return false;
  if (element.scrollHeight <= element.clientHeight) return false;
  return deltaY < 0
    ? element.scrollTop > 0
    : element.scrollTop + element.clientHeight < element.scrollHeight - EDGE_TOLERANCE;
}

/**
 * Rolagem lateral mais usável para trilhos (Kanban): a roda do mouse vira rolagem horizontal
 * quando o ponteiro não está sobre uma lista que ainda pode rolar na vertical, e expõe o estado
 * das bordas para setas e esmaecimentos.
 */
export function useHorizontalScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ canScrollLeft: false, canScrollRight: false });

  const updateEdges = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const canScrollLeft = element.scrollLeft > EDGE_TOLERANCE;
    const canScrollRight = element.scrollLeft + element.clientWidth < element.scrollWidth - EDGE_TOLERANCE;
    setEdges((current) =>
      current.canScrollLeft === canScrollLeft && current.canScrollRight === canScrollRight
        ? current
        : { canScrollLeft, canScrollRight },
    );
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    function handleWheel(event: WheelEvent) {
      if (!element) return;
      // Trackpad já rola na horizontal sozinho; com shift o navegador também converte.
      if (event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      if (element.scrollWidth <= element.clientWidth) return;

      let node = event.target instanceof HTMLElement ? event.target : null;
      while (node && node !== element) {
        if (canScrollVertically(node, event.deltaY)) return;
        node = node.parentElement;
      }

      event.preventDefault();
      element.scrollBy({ left: event.deltaY });
    }

    updateEdges();
    // `passive: false` é obrigatório para o preventDefault segurar a rolagem vertical da página.
    element.addEventListener("wheel", handleWheel, { passive: false });
    element.addEventListener("scroll", updateEdges, { passive: true });
    const observer = new ResizeObserver(updateEdges);
    observer.observe(element);

    return () => {
      element.removeEventListener("wheel", handleWheel);
      element.removeEventListener("scroll", updateEdges);
      observer.disconnect();
    };
  }, [updateEdges]);

  const scrollByColumn = useCallback((direction: 1 | -1) => {
    const element = ref.current;
    if (!element) return;
    // Avança uma coluna (largura do primeiro filho + gap), não a tela toda: não se perde o contexto.
    const first = element.firstElementChild as HTMLElement | null;
    const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 0;
    const step = first ? first.offsetWidth + gap : element.clientWidth * 0.8;
    element.scrollBy({ left: step * direction, behavior: "smooth" });
  }, []);

  return { ref, ...edges, scrollByColumn, updateEdges };
}
