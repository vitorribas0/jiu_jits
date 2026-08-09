@AGENTS.md

# Gaviões — sistema da academia de jiu-jitsu

Next.js 16 (App Router) · TypeScript · Tailwind 4 · MongoDB/Mongoose.

## Subir o ambiente

```bash
mongod --dbpath ~/data/mongodb   # banco local, database "gavioes"
npm run dev                      # http://localhost:3000
```

`brew services start mongodb-community` falha nesta máquina; rodar o `mongod`
direto funciona.

> **O banco de dev tem dados reais** — contas da família e check-ins feitos de
> dentro do tatame. Não limpe as coleções. Para testar, crie registros com
> e-mail `@qa.local` ou nome `QA ...`, guarde os IDs e apague só eles.

## Decisões que não se leem no código

**Autorização consulta o banco, não só o token.** `lib/auth.ts` expõe
`authenticate` e `requireRole`, ambos assíncronos: eles carregam o usuário a
cada requisição. O JWT vale 7 dias e sozinho carregaria um retrato velho —
alguém desativado seguiria com acesso e uma promoção só valeria no próximo
login. Custa uma consulta por `_id`.

**Campo novo com `default` não alcança documento antigo.** Por isso as
consultas usam `active: { $ne: false }` e as checagens comparam
`=== false`, nunca `!active`. Ao adicionar um campo assim, faça o backfill.

**Fuso é resolvido no cliente.** As rotas de agenda devolvem o horário cru e
uma janela de um dia a mais de cada lado; quem agrupa por dia é o navegador.
Agrupar no servidor jogaria o treino da noite para o dia seguinte. Fotos
guardam `takenAt` ao meio-dia UTC — meia-noite cairia no dia anterior no
horário de Brasília.

**Imagens têm dois destinos.** `lib/storage.ts` usa o Cloudinary quando as três
variáveis estão preenchidas e cai para o MongoDB quando não. Assim o upload
funciona sem conta em serviço externo. Os bytes têm `select: false`, e como
`<img src>` não manda cabeçalho de autenticação, o cliente busca via
`fetchImageUrl` e monta um object URL (`AuthImage`, `ClassImage`).

**Presença tem duas dimensões.** `status` é pontualidade (presente/atrasado) e
`approval` é a confirmação do professor (pendente/aprovado/recusado). Só o
aprovado conta na frequência, em todos os contadores. Recusar preserva o
registro; cancelar (`DELETE /api/checkin/[id]`) apaga e libera o aluno a bater
ponto de novo naquele dia.

**Mudou schema? Reinicie o dev server.** O Mongoose cacheia o modelo em
`mongoose.models.X` e o HMR não o recria — a rota segue validando contra o
schema antigo, com erro que não bate com o código na tela.

## Interface

Sistema de design em `app/components/ui.tsx` (zinc/indigo). Reaproveite
`Card`, `Button`, `Field`, `Alert`, `BeltBadge`, `Stat`, `EmptyState`,
`Modal` em vez de criar visual novo por tela. Textos em português, no
imperativo, sem jargão de sistema.

O app é claro em todas as telas de propósito: o `prefers-color-scheme: dark`
herdado do template deixava o texto quase branco sobre os cards brancos.

`Shell` aceita `nav` e vira layout com barra lateral; em tela estreita a lista
vira gaveta.

## Mapa rápido

| Onde | O quê |
|---|---|
| `lib/models/` | User, Academy, Class, CheckIn, Photo |
| `lib/auth.ts` | `authenticate`, `requireRole`, emissão de JWT |
| `lib/geo.ts` | distância Haversine para o check-in |
| `lib/storage.ts` | Cloudinary ou MongoDB para imagens |
| `app/api/` | rotas REST por recurso |
| `app/dashboard/{admin,professor,aluno}` | painéis por papel |
| `app/dashboard/turma/[id]` | chamada por graduação + calendário |
| `app/dashboard/academia/[id]` | turmas da unidade, matrícula no lugar |
