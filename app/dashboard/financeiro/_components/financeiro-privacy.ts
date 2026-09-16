"use client";

//* Libraries Imports
import { createContext, useCallback, useContext } from "react";

//* Utils Imports
import { formatCurrency } from "@/lib/format-currency";

export const MASKED_VALUE = "R$ ••••";

type FinanceiroPrivacyValue = {
  isHidden: boolean;
  toggle: () => void;
};

/**
 * Modo privacidade da aba Financeiro. O estado vive na página (e não no `localStorage`) de
 * propósito: toda vez que a aba é aberta os valores começam ocultos — é o que protege quando a
 * tela é aberta perto de outras pessoas. Dialogs também leem o contexto, já que portais do React
 * preservam a árvore de contexto.
 */
export const FinanceiroPrivacyContext = createContext<FinanceiroPrivacyValue>({
  isHidden: false,
  toggle: () => {},
});

export function formatCurrencyPrivate(value: number, isHidden: boolean) {
  return isHidden ? MASKED_VALUE : formatCurrency(value);
}

export function useFinanceiroPrivacy() {
  const { isHidden, toggle } = useContext(FinanceiroPrivacyContext);
  const formatValor = useCallback((value: number) => formatCurrencyPrivate(value, isHidden), [isHidden]);
  return { isHidden, toggle, formatValor };
}
