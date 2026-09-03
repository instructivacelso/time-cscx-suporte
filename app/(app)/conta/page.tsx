import { redirect } from 'next/navigation';
import { Avatar, Badge, Card, PageHeader, SectionTitle } from '@/components/ui';
import { getSession } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/constants';
import { updateMyProfileAction } from '@/app/actions';
import { PasswordForm } from './password-form';

export const dynamic = 'force-dynamic';

export default async function ContaPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <>
      <PageHeader
        title="Minha conta"
        subtitle="Seus dados de acesso ao CSCX."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Dados da conta" />

          <div className="mb-4 flex items-center gap-3">
            <Avatar name={session.name} color={session.avatarColor} size={48} />
            <div>
              <p className="text-sm font-medium text-ink-900">{session.name}</p>
              <p className="text-xs text-ink-500">{session.email}</p>
              <Badge tone="brand">{ROLE_LABELS[session.role]}</Badge>
            </div>
          </div>

          <form action={updateMyProfileAction} className="space-y-2">
            <label className="label" htmlFor="meu-nome">Nome</label>
            <input id="meu-nome" name="name" className="input" defaultValue={session.name} required />

            <label className="label pt-1" htmlFor="minha-cor">Cor do avatar</label>
            <input
              id="minha-cor"
              name="avatarColor"
              type="color"
              className="input h-10"
              defaultValue={session.avatarColor}
            />

            <div className="pt-2">
              <button className="btn-ghost" type="submit">Salvar dados</button>
            </div>

            <p className="pt-1 text-xs text-ink-500">
              O e-mail e o perfil de acesso só podem ser alterados por um administrador, na tela
              Equipe.
            </p>
          </form>
        </Card>

        <Card>
          <SectionTitle
            title="Alterar senha"
            description="Escolha uma senha que só você conheça. Ela passa a valer no próximo acesso."
          />
          <PasswordForm />
        </Card>
      </div>
    </>
  );
}
