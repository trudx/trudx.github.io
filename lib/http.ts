"use client";

//* Libraries Imports
import axios from "axios";

//* Services Imports
import { supabase } from "@/hooks/supabase";

//* Types Imports
import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";

//* Utils Imports
import env from "@/lib/env";

/**
 * Instância única de HTTP do app, apontada pra API REST do Supabase (PostgREST).
 *
 * Tudo que fala com o banco passa por aqui — trocar de backend depois é mexer neste arquivo e nos
 * serviços de `services/`, sem tocar em hook nem em tela.
 *
 * O `supabase-js` continua no projeto, mas **só pra autenticação** (sessão, login, refresh de
 * token). Ele é a fonte do access token que o interceptor injeta abaixo.
 */
export const http: AxiosInstance = axios.create({
  baseURL: `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`,
  headers: { "Content-Type": "application/json" },
});

http.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  config.headers.set("apikey", env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  // Sem sessão, a chave pública vale como bearer e a RLS barra tudo que exige `auth.uid()`.
  config.headers.set(
    "Authorization",
    `Bearer ${token ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
  );

  return config;
});

/**
 * Erro normalizado da API.
 *
 * Preserva o `code` do Postgres (ex.: `23505` de violação de unicidade, `42703` de coluna
 * inexistente) porque os hooks decidem a mensagem ao usuário a partir dele.
 */
export class HttpError extends Error {
  readonly code?: string;
  readonly details?: string;
  readonly hint?: string;
  readonly status?: number;

  constructor(
    message: string,
    options: { code?: string; details?: string; hint?: string; status?: number } = {},
  ) {
    super(message);
    this.name = "HttpError";
    this.code = options.code;
    this.details = options.details;
    this.hint = options.hint;
    this.status = options.status;
  }
}

type PostgrestErrorBody = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

type RetriableConfig = InternalAxiosRequestConfig & { _authRetried?: boolean };

/** Renovações simultâneas dividem a mesma chamada, para não gastar o refresh token duas vezes. */
let refreshing: Promise<boolean> | null = null;

function refreshSession() {
  refreshing ??= supabase.auth
    .refreshSession()
    .then(({ data, error }) => Boolean(data.session) && !error)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** O PostgREST responde 401 (`PGRST301`, "JWT expired") quando o access token em cache já venceu. */
function isExpiredJwt(error: AxiosError<PostgrestErrorBody>) {
  const message = error.response?.data?.message ?? "";
  return error.response?.status === 401 && (error.response.data?.code === "PGRST301" || /jwt/i.test(message));
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<PostgrestErrorBody>) => {
    const config = error.config as RetriableConfig | undefined;

    // Ao abrir o app com a aba parada, o token em cache pode ter vencido: renova e repete uma vez.
    if (config && !config._authRetried && isExpiredJwt(error) && (await refreshSession())) {
      config._authRetried = true;
      return http.request(config);
    }

    const body = error.response?.data;

    throw new HttpError(body?.message ?? error.message ?? "Falha na comunicação com o servidor", {
      code: body?.code,
      details: body?.details,
      hint: body?.hint,
      status: error.response?.status,
    });
  },
);

export default http;
