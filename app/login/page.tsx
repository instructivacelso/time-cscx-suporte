import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { LoginForm } from './login-form';
import { LogoMark, Wordmark } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.role === 'ALUNO' ? '/portal' : '/dashboard');

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* ── Formulário ─────────────────────────────────────── */}
      <div className="relative flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-16">
        <div className="absolute right-5 top-5">
          <ThemeToggle />
        </div>

        <div className="mx-auto w-full max-w-[360px] animate-fade-in">
          <Wordmark size={46} badge="dark" className="mb-8" />

          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight text-ink-950">
            Bem-vindo de volta
          </h1>
          <p className="mb-7 mt-1.5 text-sm text-ink-500">Entre para acessar a plataforma.</p>

          <LoginForm />
        </div>

        <p className="absolute bottom-5 left-0 w-full text-center text-[11px] text-ink-400">
          © {new Date().getFullYear()} Escola Instructiva
        </p>
      </div>

      {/* ── Painel da marca ────────────────────────────────── */}
      <div className="relative hidden overflow-hidden bg-graphite-950 lg:block">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(65% 55% at 50% 38%, rgba(250,113,21,.34) 0%, transparent 64%)',
          }}
        />

        <div className="relative grid h-full place-items-center p-12">
          <div className="text-center">
            <LogoMark size={104} badge className="mx-auto mb-7 animate-float" />
            <p className="font-display text-2xl font-semibold tracking-tight text-white">
              Escola Instructiva
            </p>
            <p className="mt-2 text-sm text-white/55">
              Customer Success &amp; Customer Experience
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
