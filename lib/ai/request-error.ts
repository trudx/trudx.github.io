export type AiFailureKind = "network" | "offline" | "timeout" | "http" | "invalid-response";

export class AiRequestError extends Error {
  readonly kind: AiFailureKind;
  readonly diagnosticId: string;
  readonly status?: number;

  constructor(kind: AiFailureKind, message: string, diagnosticId: string, status?: number) {
    super(message);
    this.name = "AiRequestError";
    this.kind = kind;
    this.diagnosticId = diagnosticId;
    this.status = status;
  }
}

export function describeAiTransportFailure(
  error: unknown,
  online: boolean,
  provider: string,
  diagnosticId: string,
) {
  if (error instanceof Error && error.name === "TimeoutError")
    return new AiRequestError(
      "timeout",
      `${provider} não respondeu em 120 segundos. Confira os logs antes de repetir ações. Diagnóstico: ${diagnosticId}.`,
      diagnosticId,
    );
  if (!online)
    return new AiRequestError(
      "offline",
      `O navegador está offline. Reconecte-se e tente novamente. Diagnóstico: ${diagnosticId}.`,
      diagnosticId,
    );
  return new AiRequestError(
    "network",
    `O navegador não conseguiu receber uma resposta de ${provider}. Não há status HTTP para identificar a causa: pode ser DNS, TLS, bloqueio de extensão, rede ou CORS. Abra os logs pelo botão de diagnóstico; a aba Rede do DevTools mostra o bloqueio exato. Diagnóstico: ${diagnosticId}.`,
    diagnosticId,
  );
}
