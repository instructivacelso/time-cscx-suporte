import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { LoginForm } from './login-form';
import { LogoMark, Wordmark } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';

export const dynamic = 'force-dynamic';

const HIGHLIGHTS = [
  { t: 'Jornada em 11 etapas', d: 'do primeiro acesso ao embaixador' },
  { t: 'Health Score explicado', d: '9 indicadores, nota justificada' },
  { t: 'Alertas de risco', d: 'antes da evasão acontecer' },
  { t: 'NPS e CSAT automáticos', d: 'D+30, D+60, D+90 e conclusão' },
  { t: 'Réguas de relacionamento', d: 'WhatsApp e e-mail no piloto automático' },
  { t: 'Assistente com IA', d: 'resume, analisa e escreve por você' },
];

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.role === 'ALUNO' ? '/portal' : '/dashboard');

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* ── Formulário ─────────────────────────────────────── */}
      <div className="relative flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-16">
        <div className="absolute right-5 top-5">
          <ThemeToggle />
        </div>

        <div className="mx-auto w-full max-w-[380px] animate-fade-in">
          <Wordmark size={46} badge="dark" className="mb-7" />

          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight text-ink-950">
            Bem-vindo de volta
          </h1>
          <p className="mb-7 mt-1.5 text-sm text-ink-500">
            Entre para acompanhar a jornada dos seus alunos.
          </p>

          <LoginForm />
        </div>

        <p className="absolute bottom-5 left-0 w-full text-center text-[11px] text-ink-400">
          © {new Date().getFullYear()} Escola Instructiva · CSCX
        </p>
      </div>

      {/* ── Painel da marca ────────────────────────────────── */}
      <div className="relative hidden overflow-hidden bg-graphite-950 lg:block">
        {/* brilho de marca */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(70% 55% at 78% 18%, rgba(250,113,21,.42) 0%, transparent 62%), radial-gradient(60% 50% at 12% 88%, rgba(255,170,40,.22) 0%, transparent 60%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(75% 75% at 50% 45%, #000 30%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(75% 75% at 50% 45%, #000 30%, transparent 100%)',
          }}
        />

        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <div className="flex items-center gap-3">
            <LogoMark size={44} badge />
            <div className="leading-tight">
              <p className="text-[15px] font-semibold text-white">Escola Instructiva</p>
              <p className="text-xs text-white/55">Eletrônica e manutenção industrial</p>
            </div>
          </div>

          <div className="max-w-lg">
            <span className="chip mb-5 border border-white/15 bg-white/10 text-white/80 backdrop-blur">
              CSCX · Customer Success &amp; Customer Experience
            </span>
            <h2 className="font-display text-[38px] font-semibold leading-[1.12] tracking-tight text-white xl:text-[44px]">
              Cada aluno acompanhado,
              <br />
              <span className="bg-gradient-to-r from-brand-400 to-amber-300 bg-clip-text text-transparent">
                do primeiro acesso ao certificado.
              </span>
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/65">
              A plataforma central de relacionamento da escola: mede satisfação, antecipa risco de
              evasão e transforma dado em ação para o time.
            </p>
          </div>

          <ul className="grid max-w-xl grid-cols-2 gap-2.5">
            {HIGHLIGHTS.map((h) => (
              <li
                key={h.t}
                className="rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-3 backdrop-blur transition hover:border-white/20 hover:bg-white/10"
              >
                <p className="text-[13px] font-medium text-white">{h.t}</p>
                <p className="mt-0.5 text-[11px] text-white/50">{h.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
