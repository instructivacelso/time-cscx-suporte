import { NextResponse } from 'next/server';
import { lerPayload, processarWebhookCademi, registrarWebhook } from '@/server/cademi';
import { recordAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * Webhook de entrada da Cademí.
 *
 *   POST /api/webhooks/cademi?chave=SEGREDO
 *
 * A Cademí só permite informar a URL, então a autenticação vai na própria
 * URL (`?chave=`). Também aceitamos o cabeçalho `x-api-key`, para quem
 * puder configurá-lo.
 *
 * Eventos tratados: usuário criado, entrega adicionada (curso liberado),
 * progresso, certificado emitido e provas. Qualquer outro é registrado e
 * ignorado sem erro.
 */

function autorizado(request: Request) {
  const esperado = process.env.CADEMI_WEBHOOK_SECRET ?? process.env.API_KEY;
  if (!esperado) return { ok: false as const, motivo: 'sem-segredo' };

  const url = new URL(request.url);
  const informado = url.searchParams.get('chave') ?? url.searchParams.get('key') ?? request.headers.get('x-api-key');

  return informado === esperado
    ? { ok: true as const, motivo: '' }
    : { ok: false as const, motivo: 'chave-invalida' };
}

export async function POST(request: Request) {
  const auth = autorizado(request);

  if (!auth.ok && auth.motivo === 'sem-segredo') {
    return NextResponse.json(
      {
        erro: 'Webhook não configurado.',
        comoResolver:
          'Defina a variável CADEMI_WEBHOOK_SECRET no serviço da aplicação e use o mesmo valor em ?chave= na URL cadastrada na Cademí.',
      },
      { status: 503 },
    );
  }
  if (!auth.ok) {
    return NextResponse.json({ erro: 'Chave inválida.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ erro: 'Corpo não é um JSON válido.' }, { status: 400 });
  }

  const lido = lerPayload(body);

  try {
    const resultado = await processarWebhookCademi(body);

    await registrarWebhook({
      source: 'cademi',
      body,
      eventType: lido.eventType,
      email: lido.email,
      studentId: resultado.studentId,
      status: resultado.status,
      message: resultado.message,
    });

    if (resultado.status === 'PROCESSADO' && resultado.studentId) {
      await recordAudit({
        action: 'WEBHOOK',
        entity: 'student',
        entityId: resultado.studentId,
        summary: `Cademí — ${lido.eventType ?? 'evento'}: ${resultado.message}`,
      });
    }

    // Sempre 200: a Cademí reenvia quando recebe erro, e um evento que não
    // sabemos tratar não deve virar uma fila de reenvios.
    return NextResponse.json({
      ok: resultado.status !== 'ERRO',
      status: resultado.status,
      acao: resultado.acao,
      mensagem: resultado.message,
      alunoId: resultado.studentId ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cademi] falha ao processar webhook:', msg);

    await registrarWebhook({
      source: 'cademi',
      body,
      eventType: lido.eventType,
      email: lido.email,
      status: 'ERRO',
      message: msg,
    });

    return NextResponse.json({ ok: false, status: 'ERRO', mensagem: msg }, { status: 200 });
  }
}

/** Ajuda a testar: abrir a URL no navegador diz se a chave está certa. */
export async function GET(request: Request) {
  const auth = autorizado(request);

  if (!auth.ok && auth.motivo === 'sem-segredo') {
    return NextResponse.json(
      { pronto: false, motivo: 'Falta definir CADEMI_WEBHOOK_SECRET nas variáveis do serviço.' },
      { status: 503 },
    );
  }
  if (!auth.ok) {
    return NextResponse.json({ pronto: false, motivo: 'Chave inválida.' }, { status: 401 });
  }

  return NextResponse.json({
    pronto: true,
    mensagem: 'Endpoint da Cademí ativo. Cadastre esta mesma URL nos webhooks da plataforma.',
    eventosTratados: [
      'Usuário criado → cria o aluno e inicia o onboarding',
      'Entrega adicionada → matricula no curso liberado',
      'Usuário progresso → atualiza o percentual do curso',
      'Certificado emitido → conclui a matrícula e dispara o NPS',
      'Prova aprovado/reprovado → registra a avaliação',
    ],
  });
}
