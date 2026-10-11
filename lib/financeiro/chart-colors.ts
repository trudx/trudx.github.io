/**
 * Cores dos gráficos do financeiro. Receitas × despesas usam os slots 3 (aqua) e 2 (laranja) da
 * paleta categórica validada (ΔE CVD ≥ 9; nenhuma depende só de cor porque há legenda e rótulos).
 * Os pares claro/escuro são degraus próprios de cada superfície, não uma inversão automática.
 */
export const CHART_COLORS = {
  receitas: { light: "#1baf7a", dark: "#199e70" },
  despesas: { light: "#eb6834", dark: "#d95926" },
  neutro: { light: "#2a78d6", dark: "#3987e5" },
} as const;
