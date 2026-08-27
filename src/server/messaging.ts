
/**
 * Camada de envio de mensagens.
 *
 * Enquanto as integrações não estiverem configuradas (variáveis de ambiente
 * ausentes), tudo roda em **modo simulado**: a mensagem é registrada no
 * histórico de execuções sem sair da plataforma. Basta preencher as chaves
 * em Integrações para os envios passarem a ser reais.
 */

export type Channel = 'EMAIL' | 'WHATSAPP' | 'PLATAFORMA' | 'TAREFA_INTERNA' | 'WEBHOOK';

export interface SendResult {
  ok: boolean;
  simulated: boolean;
  provider: string;
  detail?: string;
  error?: string;
}

export function whatsappConfigured() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendWhatsApp(to: string, body: string): Promise<SendResult> {
  if (!whatsappConfigured()) {
    return { ok: true, simulated: true, provider: 'whatsapp', detail: `→ ${to}: ${body.slice(0, 120)}` };
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to.replace(/\D/g, ''),
          type: 'text',
          text: { body },
        }),
      },
    );
    if (!res.ok) {
      return { ok: false, simulated: false, provider: 'whatsapp', error: await res.text() };
    }
    return { ok: true, simulated: false, provider: 'whatsapp' };
  } catch (err) {
    return { ok: false, simulated: false, provider: 'whatsapp', error: String(err) };
  }
}

export async function sendEmail(to: string, subject: string, body: string): Promise<SendResult> {
  if (!smtpConfigured()) {
    return {
      ok: true,
      simulated: true,
      provider: 'smtp',
      detail: `→ ${to} | ${subject}: ${body.slice(0, 120)}`,
    };
  }
  try {
    // Import dinâmico para não exigir nodemailer quando SMTP não está em uso.
    const nodemailer = await import('nodemailer').catch(() => null);
    if (!nodemailer) {
      return { ok: true, simulated: true, provider: 'smtp', detail: 'nodemailer não instalado' };
    }
    const transport = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to,
      subject,
      text: body,
      html: body.replace(/\n/g, '<br/>'),
    });
    return { ok: true, simulated: false, provider: 'smtp' };
  } catch (err) {
    return { ok: false, simulated: false, provider: 'smtp', error: String(err) };
  }
}

export async function callWebhook(url: string, payload: unknown): Promise<SendResult> {
  if (!url) return { ok: false, simulated: false, provider: 'webhook', error: 'URL ausente' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, simulated: false, provider: 'webhook', detail: String(res.status) };
  } catch (err) {
    return { ok: false, simulated: false, provider: 'webhook', error: String(err) };
  }
}

/** Substitui as variáveis {{...}} do template. */
export function renderTemplate(template: string, vars: Record<string, string | number | null | undefined>) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key];
    return value === undefined || value === null ? '' : String(value);
  });
}
