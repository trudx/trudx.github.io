import { normalizeDescription } from "./text.ts";

type CategoriaTermos = { id: string; termos: string[] };

/**
 * Categoria cujo termo aparece na descrição. Em caso de mais de uma, vence o termo mais longo (mais
 * específico): "uber eats" ganha de "uber". Sem correspondência devolve `null` — nunca chuta.
 */
export function suggestCategoriaId(
  descricao: string | null,
  categorias: CategoriaTermos[],
): string | null {
  const text = normalizeDescription(descricao ?? "");
  if (!text) return null;

  let best: { id: string; size: number } | null = null;
  for (const categoria of categorias) {
    for (const termo of categoria.termos) {
      const needle = normalizeDescription(termo);
      if (needle && text.includes(needle) && (!best || needle.length > best.size)) {
        best = { id: categoria.id, size: needle.length };
      }
    }
  }
  return best?.id ?? null;
}
