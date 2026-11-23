// Sağlayıcı seçimi. API anahtarları YALNIZCA sunucu ortam değişkenlerinde bulunur.
import {
  EXTRACTION_INSTRUCTIONS,
  EXTRACTION_SCHEMA,
  type MenuExtractionProvider,
  type RawExtraction,
  type SourceFile,
} from '../_shared/menu-extraction.ts';

export interface ProviderStatus {
  configured: boolean;
  provider: string | null;
  reason?: string;
}

export function providerStatus(): ProviderStatus {
  const name = (Deno.env.get('MENU_IMPORT_PROVIDER') ?? '').trim().toLowerCase();
  if (!name) return { configured: false, provider: null, reason: 'MENU_IMPORT_PROVIDER tanımlı değil' };
  if (name === 'anthropic') {
    return Deno.env.get('ANTHROPIC_API_KEY')
      ? { configured: true, provider: 'anthropic' }
      : { configured: false, provider: 'anthropic', reason: 'ANTHROPIC_API_KEY tanımlı değil' };
  }
  return { configured: false, provider: name, reason: `Desteklenmeyen sağlayıcı: ${name}` };
}

export function createProvider(): MenuExtractionProvider {
  const status = providerStatus();
  if (!status.configured) throw new Error(status.reason ?? 'Sağlayıcı yapılandırılmamış');
  return new AnthropicMenuProvider(Deno.env.get('ANTHROPIC_API_KEY')!, Deno.env.get('MENU_IMPORT_MODEL') || 'claude-opus-5-5');
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Claude (Anthropic Messages API) ile yapılandırılmış çıktı. */
class AnthropicMenuProvider implements MenuExtractionProvider {
  readonly name = 'anthropic';
  constructor(private apiKey: string, readonly model: string) {}

  async extract(files: SourceFile[]): Promise<RawExtraction & { inputTokens?: number; outputTokens?: number }> {
    const { default: Anthropic } = await import('npm:@anthropic-ai/sdk@1.12.0');
    const client = new Anthropic({ apiKey: this.apiKey, maxRetries: 1, timeout: 120_000 });

    const content = [
      ...files.map((f) =>
        f.mime === 'application/pdf'
          ? { type: 'document', source: { type: 'base64', media_type: f.mime, data: toBase64(f.bytes) } }
          : { type: 'image', source: { type: 'base64', media_type: f.mime, data: toBase64(f.bytes) } },
      ),
      { type: 'text', text: 'Bu menüdeki ürünleri kurallara uygun şekilde çıkar.' },
    ];

    // Güvenlik sınıflandırıcısı reddederse sunucu tarafı yedek modele düşülür.
    // deno-lint-ignore no-explicit-any
    const stream = (client.beta.messages as any).stream({
      model: this.model,
      max_tokens: 32000,
      system: EXTRACTION_INSTRUCTIONS,
      messages: [{ role: 'user', content }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: EXTRACTION_SCHEMA } },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') throw new Error('Sağlayıcı bu içeriği işlemeyi reddetti');
    if (message.stop_reason === 'max_tokens') throw new Error('Menü çok uzun; daha az sayfa ile tekrar deneyin');
    // deno-lint-ignore no-explicit-any
    const text = message.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    let parsed: RawExtraction;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Sağlayıcı yanıtı okunamadı');
    }
    return { ...parsed, inputTokens: message.usage?.input_tokens, outputTokens: message.usage?.output_tokens };
  }
}
