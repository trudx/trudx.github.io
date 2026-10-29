# trudx — identidade visual

труд (trud) = trabalho. Estrela soviética facetada, sem cor: piche, grafite, aço, chumbo, cinéreo e osso.

## Pastas
- `logo/svg` e `logo/png` (2048 px, fundo transparente): estrela facetada, sólida, medalha, wordmark e assinatura horizontal. O wordmark já está em curvas, então não precisa da fonte instalada.
  - "para-fundo-escuro" = versão clara; "para-fundo-claro" = versão escura.
- `app-icon`: favicon.ico, favicon.svg, favicon-16/32, apple-touch-icon (180), icon-192/512, icon-maskable-512 e um trecho de manifest.
- `tokens/globals.css`: tokens do shadcn/ui para o tema claro e o escuro. `tokens.json` tem os mesmos valores em formato neutro.

## Regras
- Abaixo de 32 px, use a estrela sólida, porque as facetas viram borrão.
- Respiro mínimo em volta do logo: 1/4 da largura da estrela.
- Cantos de 8 px nos controles e 10 px nos cards, borda de 1 px e sem sombra dura.

Fontes: Unbounded (SIL OFL) e Geist / Geist Mono (SIL OFL), todas no Google Fonts.
