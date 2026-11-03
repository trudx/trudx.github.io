export const MAX_CHAT_IMAGES = 4;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_SIDE = 1568;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const ACCEPTED_IMAGE_TYPES = ACCEPTED_TYPES.join(",");

/** Reduz a imagem para no máximo 1568px no maior lado e devolve um data URL JPEG. */
export async function imageFileToDataUrl(file: File): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type))
    throw new Error("Formato não suportado. Use PNG, JPEG, WebP ou GIF.");
  if (file.size > MAX_FILE_BYTES) throw new Error("A imagem passa de 20 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível processar a imagem.");
    // Fundo branco: PNG transparente vira JPEG sem áreas pretas.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    bitmap.close();
  }
}

/** Mensagem de recusa quando o modelo ativo do catálogo não aceita imagens. */
export function imageUnsupportedMessage(modelName: string) {
  return `O modelo ${modelName} não aceita imagens. Escolha um modelo com suporte a imagem (ex.: DeepSeek V4 Flash Vision, Claude, GPT ou Gemini) para enviar.`;
}
