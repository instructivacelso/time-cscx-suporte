# CSCX — Customer Success & Customer Experience

Plataforma central de Customer Success e Customer Experience da **Escola Instructiva**.
Acompanha a jornada de cada aluno da matrícula ao pós-curso, calcula Health Score
explicado indicador a indicador, gera alertas de risco, automatiza o onboarding e a
régua de relacionamento, mede NPS e CSAT, abre planos de recuperação e entrega à
diretoria dashboards e relatórios exportáveis.

---

## Índice

- [O que o sistema faz](#o-que-o-sistema-faz)
- [Stack](#stack)
- [Rodando localmente](#rodando-localmente)
- [Deploy no Railway](#deploy-no-railway)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Perfis de acesso](#perfis-de-acesso)
- [Health Score](#health-score)
- [Alertas inteligentes](#alertas-inteligentes)
- [Automações](#automações)
- [Rotina diária](#rotina-diária)
- [API REST de integração](#api-rest-de-integração)
- [Exportações e Power BI](#exportações-e-power-bi)
- [Estrutura do projeto](#estrutura-do-projeto)

---

## O que o sistema faz

| Módulo | O que entrega |
|---|---|
| **Dashboard executivo** | Alunos, ativos, em risco, Health Score médio, NPS, CSAT, taxa de conclusão, churn, retenção, tempo médio de resposta, receita por aluno, MRR e evolução mensal. |
| **Painel operacional** | A rotina do dia: alertas de alta prioridade, tarefas, prioridade de contato e saúde da carteira. |
| **Carteira** | Lista filtrável por faixa de Health Score, etapa, responsável e risco. |
| **Ficha 360º do aluno** | Visão geral, estudos, Health Score explicado, jornada, CRM, pesquisas, tarefas/planos e financeiro. |
| **Jornada** | Onze etapas (Novo → Embaixador) com checklist próprio e funil de distribuição. |
| **Onboarding** | Régua automática de entrada + checklist de 6 itens com percentual por aluno. |
| **Health Score** | Nove indicadores ponderados, faixas configuráveis e explicação da nota. |
| **Alertas** | Dez regras automáticas de risco, com severidade e tratativa. |
| **Planos de ação** | Abertos automaticamente para alunos em risco, com checklist, prazo e responsável. |
| **NPS & CSAT** | NPS em D+30/60/90 e na conclusão; CSAT após atendimento, mentoria, onboarding e conclusão. Página pública de resposta. |
| **Automações** | Doze réguas por evento, em WhatsApp, e-mail, plataforma ou tarefa interna. |
| **Playbooks** | Sequências padronizadas de atendimento para a equipe. |
| **Assistente CSCX** | IA que resume histórico, aponta risco, sugere plano, escreve mensagens e analisa indicadores. |
| **Relatórios** | Exportação em CSV, Excel, PDF (versão para impressão) e feed JSON para Power BI. |
| **Portal do aluno** | Progresso, trilha, metas, checklist, certificados, mensagens e pesquisas. |
| **Equipe, integrações, auditoria** | Perfis de acesso, status das integrações e registro de todas as ações. |

---

## Identidade e interface

- Marca da **Escola Instructiva**: símbolo em `public/logo.png` (usado também como favicon)
  e paleta derivada do laranja do logotipo.
- **Tema claro e escuro** com alternância no próprio sistema (botão de sol/lua na barra
  lateral, no portal do aluno e nas telas públicas). A escolha fica salva no navegador e o
  tema é aplicado antes da primeira pintura, sem piscar.
- Interface responsiva: navegação lateral no desktop, menu deslizante no celular.
- Relatórios saem sempre no tema claro na impressão, mesmo com o modo escuro ativo.

## Stack

- **Next.js 15** (App Router, Server Components e Server Actions) + **TypeScript**
- **PostgreSQL** + **Drizzle ORM** (schema tipado, sem binários nativos)
- **Tailwind CSS** para a interface, **Recharts** para os gráficos
- **jose** + **bcryptjs** para sessões JWT em cookie httpOnly
- **OpenAI** para o Assistente CSCX (opcional — sem a chave, roda em modo simulado)
- **ExcelJS** para as exportações em `.xlsx`

Tudo em um único serviço: interface, API REST e rotinas rodam no mesmo deploy.

---

## Rodando localmente

```bash
# 1. Dependências
npm install

# 2. Configuração
cp .env.example .env
#    edite DATABASE_URL e AUTH_SECRET

# 3. Banco + dados de demonstração
npm run db:push        # cria as tabelas
npm run db:seed        # popula equipe, cursos e 72 alunos com histórico

# 4. Subir
npm run dev            # http://localhost:3000
```

### Acessos de demonstração

Todos com a senha `cscx2026` (ou o valor de `SEED_PASSWORD`):

| Perfil | E-mail |
|---|---|
| Administrador | `admin@escolainstructiva.com.br` |
| Coordenador CSCX | `coordenacao@escolainstructiva.com.br` |
| Analista CSCX | `analista@escolainstructiva.com.br` |
| Aluno | `aluno@exemplo.com.br` |

> `npm run db:reset` limpa tudo e popula de novo.

---

## Deploy no Railway

O projeto traz um **Dockerfile** na raiz e o `railway.json` já aponta para ele.
O Railway constrói a imagem direto, sem passar pelo Nixpacks — o que evita a
falha de *cache mount* do builder (`runc run failed ... error mounting`).

1. **Novo projeto** → *Deploy from GitHub repo* → selecione este repositório.
2. **Adicione o PostgreSQL**: *New → Database → Add PostgreSQL*.
3. **Variáveis** — aba *Variables* do serviço da aplicação:
   ```
   DATABASE_URL = ${{Postgres.DATABASE_URL}}
   AUTH_SECRET  = <openssl rand -base64 32>
   APP_URL      = https://<seu-app>.up.railway.app
   ```
   Não defina `NODE_ENV` nem `PORT` — a plataforma cuida disso.
4. **Sem volume no serviço da aplicação.** O CSCX não guarda arquivos em disco;
   quem precisa de volume é o PostgreSQL. Um volume montado em `/app` sobrescreve
   a imagem e quebra o deploy — se existir um, remova em *Settings → Volumes*.
5. **Gere o domínio**: *Settings → Networking → Generate Domain*. Sem isso o
   serviço fica como *Unexposed* e não abre no navegador.
6. **Popular a base** (opcional, só na primeira vez):
   ```bash
   railway run npm run db:seed
   ```
7. **Rotina diária**: crie um *Cron* chamando
   `POST https://<seu-app>.up.railway.app/api/cron/rotina` com o header
   `x-cron-key: $CRON_SECRET`, uma vez por dia
   (sugestão: 06:00 BRT → `0 9 * * *` em UTC).

Na subida, `scripts/start.mjs` aplica o schema no banco (`drizzle-kit push`) e
inicia o servidor em `0.0.0.0:$PORT`. Se o banco ainda não estiver ligado, o app
sobe assim mesmo e registra o aviso no log — nada de contêiner reiniciando em loop.

### Reproduzindo o build da nuvem na sua máquina

Com Docker:

```bash
docker build -t cscx .
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e AUTH_SECRET=$(openssl rand -base64 32) \
  cscx
```

Sem Docker (simula a instalação em modo produção):

```bash
rm -rf node_modules
NODE_ENV=production npm ci
NODE_ENV=production npm run build
```

Todas as dependências necessárias ao build (TypeScript, Tailwind, PostCSS,
drizzle-kit) estão em `dependencies`, e não em `devDependencies` — assim o build
funciona mesmo quando a plataforma instala em modo produção.

> **Enviando o código para o GitHub:** prefira `git push` ao botão
> *Add files via upload* da interface web, que costuma perder arquivos em pastas
> aninhadas. Depois de subir, confira se `src/`, `scripts/`, `public/`,
> `package-lock.json` e o `Dockerfile` estão todos lá.

---

## Variáveis de ambiente

| Variável | Para quê | Obrigatória |
|---|---|---|
| `DATABASE_URL` | Conexão PostgreSQL | ✅ |
| `AUTH_SECRET` | Assinatura das sessões (32+ caracteres) | ✅ |
| `APP_URL` | Links das pesquisas enviadas ao aluno | recomendada |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Assistente CSCX | opcional |
| `CRON_SECRET` | Protege o endpoint da rotina diária | recomendada |
| `API_KEY` | Autentica a API REST de integração | recomendada |
| `POWERBI_API_KEY` | Autentica o feed do Power BI | opcional |
| `WHATSAPP_PHONE_ID` / `WHATSAPP_TOKEN` | Envio real por WhatsApp | opcional |
| `SMTP_*` | Envio real por e-mail | opcional |
| `LMS_*`, `CRM_*`, `STRIPE_*`, `MERCADOPAGO_*`, `ASAAS_*`, `RDSTATION_*`, `META_ADS_*`, `GA_*`, `GOOGLE_*` | Integrações | opcional |

Sem as chaves de WhatsApp/SMTP, **as automações continuam funcionando em modo
simulado**: a mensagem é montada, registrada no histórico do aluno e no log de
execuções, mas não sai da plataforma. A tela de Integrações mostra, para cada
conexão, quais variáveis já estão preenchidas.

---

## Perfis de acesso

| Perfil | Pode |
|---|---|
| **Administrador** | Tudo: equipe, integrações, auditoria, configuração. |
| **Coordenador CSCX** | Toda a carteira, playbooks, automações, dashboards gerencial e executivo, acompanhamento da equipe. |
| **Analista CSCX** | Sua carteira: contatos, tarefas, onboarding, pesquisas, Health Score, planos de ação. |
| **Aluno** | Portal: progresso, trilha, tarefas, metas, certificado, histórico, mensagens e pesquisas. |

As permissões ficam centralizadas em `src/lib/rbac.ts`.

---

## Health Score

Nota de 0 a 100 composta por nove indicadores:

| Indicador | Peso | O que mede |
|---|---:|---|
| Ativação | 15 | Onboarding concluído e primeira aula assistida |
| Frequência | 15 | Regularidade de acesso nos últimos 30 dias |
| Progresso | 20 | Avanço no curso comparado ao ritmo esperado |
| Engajamento | 15 | Aulas, atividades entregues e comunidade |
| Performance | 10 | Média das avaliações |
| Relacionamento | 10 | Contatos e resposta ao time de CS |
| Satisfação | 10 | Últimos NPS e CSAT |
| Financeiro | 5 | Situação das parcelas |
| Participação em mentorias | 10 | Presença nas mentorias oferecidas |

> **Os pesos acima somam 110, não 100.** O motor normaliza automaticamente
> (`peso ÷ soma dos pesos × 100`), então a nota final fica sempre entre 0 e 100 —
> e os pesos podem ser recalibrados na tela **Configuração** sem tocar no código.

**Classificação padrão:** 🟢 Excelente ≥ 90 · 🟢 Saudável ≥ 75 · 🟡 Atenção ≥ 60 ·
🟠 Risco ≥ 40 · 🔴 Crítico < 40 (também configurável).

Cada aluno tem a nota **explicada**: a aba *Health Score* mostra, indicador a
indicador, a nota bruta, o peso, quantos pontos entraram na nota final e a frase
que justifica aquele resultado.

O **risco de evasão** (0–100%) combina a nota com sinais de alta correlação:
dias sem acesso, inadimplência, NPS/CSAT baixos, atraso de cronograma,
onboarding incompleto e reclamações abertas.

---

## Alertas inteligentes

Reavaliados a cada rotina e a cada evento do aluno. Alertas que perdem o motivo
são resolvidos automaticamente.

| Alerta | Dispara quando |
|---|---|
| 7 dias sem acessar | `daysWithoutAccess ≥ 7` (severidade sobe em 14 e 21 dias) |
| Cronograma atrasado | Progresso 15 p.p. abaixo do ritmo esperado |
| Queda no Health Score | Perda de 10+ pontos desde o último cálculo |
| NPS baixo | Última nota ≤ 6 |
| CSAT baixo | Última nota ≤ 3 |
| Pagamento atrasado | Parcela vencida em aberto |
| Baixo engajamento | ≤ 2 aulas em 30 dias mesmo acessando |
| Pouca participação | 2+ mentorias oferecidas e nenhuma presença |
| Reclamações recorrentes | 2+ tickets de reclamação abertos |
| Risco de evasão | Probabilidade estimada ≥ 70% |

---

## Automações

Doze réguas por evento — `NOVO_ALUNO`, `ALUNO_PARADO`, `ALUNO_CONCLUINDO`,
`ALUNO_CERTIFICADO`, `ALUNO_EM_RISCO`, `ALUNO_PROMOTOR`, `PAGAMENTO_CONFIRMADO`,
`PAGAMENTO_PENDENTE`, `PESQUISA_NPS`, `PESQUISA_CSAT`, `PARABENS_CONCLUSAO` e
`OFERTA_NOVOS_CURSOS`.

As mensagens usam variáveis entre chaves duplas, editáveis na própria tela:

```
Olá {{primeiroNome}}! Você está em {{progresso}}% de {{curso}} e faz
{{diasSemAcesso}} dias que não acessa. Quer que eu ajuste seu cronograma?
```

Variáveis disponíveis: `nome`, `primeiroNome`, `curso`, `progresso`,
`diasSemAcesso`, `healthScore`, `faixa`, `riscoEvasao`, `nps`, `valor`,
`referencia`, `vencimento`, `linkPesquisa`, `linkPlataforma`, `mentor`, `analista`.

---

## Rotina diária

`POST /api/cron/rotina` (header `x-cron-key: $CRON_SECRET`) executa, em ordem:

1. Atualiza dias sem acesso e situação financeira a partir das parcelas.
2. Recalcula o Health Score de todos os alunos ativos e grava o snapshot.
3. Reavalia as regras de alertas (abre os novos, resolve os que cessaram).
4. Atualiza a etapa da jornada de cada aluno.
5. Abre plano de recuperação para quem está em risco.
6. Dispara as automações dos gatilhos correspondentes.
7. Agenda as pesquisas de NPS em D+30/60/90 e na conclusão.

Também pode ser executada manualmente em **Configuração → Rodar rotina agora**.

---

## API REST de integração

Autenticação por header `x-api-key: $API_KEY` (ou sessão de usuário interno).

### Alunos

```http
GET  /api/v1/students?q=&faixa=&etapa=&limit=&offset=
POST /api/v1/students
```

```json
{
  "code": "INS-2001",
  "name": "Maria Souza",
  "email": "maria@exemplo.com.br",
  "phone": "5511987654321",
  "origin": "YouTube"
}
```

Criar um aluno já monta o checklist de onboarding, dispara a régua de boas-vindas
e calcula o primeiro Health Score.

### Eventos do LMS e do financeiro

```http
POST /api/v1/events
```

```json
{ "type": "aula_concluida", "studentEmail": "maria@exemplo.com.br",
  "payload": { "minutes": 45, "lessons": 2, "score": 8.5 } }
```

Tipos aceitos: `acesso`, `aula_concluida`, `progresso`, `certificado`, `mentoria`,
`pagamento_confirmado`, `pagamento_pendente`. Toda chamada recalcula o Health
Score e devolve a nota, a faixa e o risco de evasão atualizados.

---

## Exportações e Power BI

| Rota | Formato |
|---|---|
| `/api/export/{alunos\|alertas\|pesquisas\|indicadores\|cursos}?format=csv` | CSV (separador `;`, com BOM — abre direto no Excel em português) |
| `…?format=xlsx` | Excel formatado, com filtro e cabeçalho fixo |
| `/api/export` | Pacote completo, uma aba por conjunto |
| `/relatorios/imprimir` | Página pronta para **imprimir / salvar em PDF** |
| `/api/powerbi` | Feed JSON (header `x-api-key: $POWERBI_API_KEY`) |

No Power BI: *Obter dados → Web → Avançado*, informe a URL e o cabeçalho.

---

## Estrutura do projeto

```
src/
├── app/
│   ├── (app)/            # área interna (dashboard, carteira, alertas, …)
│   ├── portal/           # área do aluno
│   ├── pesquisa/[id]/    # página pública de resposta de NPS/CSAT
│   ├── login/
│   ├── api/              # REST, exportações, cron, Power BI
│   └── actions.ts        # server actions (mutações + auditoria)
├── components/           # UI, gráficos, assistente, markdown
├── db/                   # schema Drizzle e conexão
├── lib/                  # auth, RBAC, auditoria, formatação, Health Score
└── server/               # regras de negócio
    ├── health-service.ts     # cálculo e snapshots
    ├── alerts-service.ts     # regras de alerta
    ├── journey-service.ts    # etapas e onboarding
    ├── survey-service.ts     # NPS e CSAT
    ├── automation-service.ts # réguas por evento
    ├── action-plan-service.ts# planos de recuperação
    ├── metrics-service.ts    # agregações dos dashboards
    ├── export-service.ts     # CSV/XLSX/Power BI
    ├── ai-service.ts         # Assistente CSCX
    └── routine.ts            # rotina diária
scripts/seed.ts           # base de demonstração
```

---

© Escola Instructiva — EDNA MUNIZ DE CASTRO LTDA
