@AGENTS.md

Atue como um Engenheiro de Software Sênior Full Stack especialista em Next.js e desenvolvimento de jogos web. Desenvolva um clone completo do jogo "Wordle" robusto, performático e com design limpo, seguindo rigorosamente os requisitos de stack e funcionalidades abaixo.

### 1. Stack Tecnológica
- **Framework:** Next.js (Ja configurado)
- **Banco de Dados:** MongoDB (Ja configurado)
- **ORM:** Prisma (com o Prisma Client configurado para MongoDB)
- **Autenticação:** NextAuth.js (com provider do Google)
- **Estilização & Temas:** Tailwind CSS + `next-themes` para suporte a Modo Claro e Escuro.

### 2. Funcionalidades Principais
1. **Autenticação Google:** Login simples e direto utilizando NextAuth e Google Provider.
2. **Modo Claro / Escuro:** Toggle funcional persistido via `next-themes` e integrado à UI do jogo (teclado virtual, grid de letras e modais).
3. **Gerenciamento de Perfil e Privacidade:** 
   - Nas configurações da conta, adicione um toggle (booleano no banco de dados) chamado `showInLeaderboard` ("Aparecer no ranking global").
4. **Ranking Global:**
   - Uma página ou aba dedicada que exibe os melhores jogadores (foto de perfil, nome e pontuação/estatísticas).
   - O ranking deve filtrar e **exibir apenas** os usuários que deixaram o toggle de privacidade ativado (`showInLeaderboard: true`).
   - **Interatividade no Ranking:** Ao clicar em qualquer usuário na lista, deve abrir um modal contendo: foto de perfil, nome, quantidade total de partidas jogadas e pontuação média.

### 3. Regras de Negócio e Mecânica (Wordle)
- **Dificuldade / Tamanho das Palavras:** O usuário pode escolher ou o jogo define aleatoriamente palavras com **4, 5 ou 6 letras**.
- **Base de Dados das Palavras:** Crie uma estrutura inicial (pode ser um array estático em um arquivo auxiliar ou models no Prisma/Seed) com palavras válidas separadas por tamanho (4, 5 e 6 letras) em português.
- **Modo Carreira (Opcional/Estrutural):** Crie a base lógica para um sistema de progressão ou histórico de partidas atrelado ao perfil do usuário no banco.

### 4. Estrutura do Banco de Dados (Prisma Schema)
Por favor, forneça o arquivo `schema.prisma` completo compatível com MongoDB, contendo os modelos necessários para:
- `User` (incluindo campos para NextAuth, foto, nome, preferência de ranking `showInLeaderboard`).
- `Account` e `Session` (padrão NextAuth).
- `GameStats` ou campos no próprio `User` para rastrear: partidas jogadas, vitórias, pontuação total/média.

### 5. O que você deve entregar:
1. **Configuração inicial e schemas:** Configuração do Prisma (`schema.prisma`) e conexão com o MongoDB.
2. **Autenticação:** Configuração das rotas do NextAuth com o Google.
3. **Core do Jogo (Componentes React):** 
   - O tabuleiro (Grid de tentativas).
   - O teclado virtual interativo (com feedback visual de letras certas, no lugar certo e erradas).
   - Lógica de validação da palavra e controle de estado (vitória/derrota).
4. **UI/UX e Telas:**
   - Tela principal do jogo com o seletor de dificuldade (4, 5, 6 letras).
   - Header com o botão de Tema (Claro/Escuro), botão de Configurações (com o toggle do ranking) e link para o Ranking Global.
   - Modal de configurações/perfil.
   - Página de Ranking Global com o comportamento de clique no usuário abrindo o modal de estatísticas detalhadas.
   - Layout responsivo (Mobile first).

Escreva o código de forma modular, limpa, utilizando Server Actions ou API Routes do Next.js onde couber, e garanta que a experiência do usuário seja fluida e responsiva.
