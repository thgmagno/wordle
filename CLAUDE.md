Quero que você desenvolva um jogo estilo Wordle completo, robusto, performático e com qualidade de produção. Ele deve ter uma experiência extremamente refinada, responsiva e consistente em desktop e mobile, com atenção rigorosa a UX, arquitetura, segurança, performance, acessibilidade e qualidade visual.

Não trate nenhuma funcionalidade como um protótipo superficial. Cada módulo deve ser implementado de forma completa, integrada e pronta para produção.

Distribua subagentes especializados para analisar, implementar, testar e revisar cada área individualmente. Cada subagente deve revisar criticamente seu próprio trabalho, identificar problemas e propor correções.

Use o comando `/loop` em cada etapa relevante. Após cada implementação, faça uma nova rodada de análise, testes e correções. Não considere uma etapa concluída apenas porque o código funciona: ela deve ser revisada até atingir um padrão elevado de qualidade.

Utilize subagentes especializados, no mínimo, para arquitetura, banco de dados, autenticação, segurança, realtime, core do jogo, banco de palavras, multiplayer, pontuação, UX/UI, responsividade, testes e revisão final.

O resultado deve ser um produto real e utilizável, não apenas uma demonstração técnica.

1. STACK TECNOLÓGICA

Utilize:

* Next.js com App Router e a versão mais recente disponível.
* TypeScript.
* MongoDB.
* Prisma.
* NextAuth.js/Auth.js com Google Provider.
* Tailwind CSS.
* `next-themes`.
* Socket.io ou Pusher/Ably, escolhendo a solução realtime que melhor se adapte ao Next.js App Router.
* Server Actions onde fizer sentido.
* API routes/endpoints quando necessário.
* Componentes React reativos para as partes interativas.
* Validação de dados no servidor.
* Arquitetura preparada para produção.

Não introduza tecnologias desnecessárias apenas para aumentar a complexidade.

2. ARQUITETURA E QUALIDADE DO PROJETO

Construa uma arquitetura modular, limpa e escalável.

Separe corretamente:

* Server Components.
* Client Components.
* Server Actions.
* APIs.
* camada de domínio;
* regras do jogo;
* persistência;
* realtime;
* autenticação/autorização;
* componentes de UI.

As regras críticas do jogo devem estar no servidor.

O cliente não pode ser considerado uma fonte confiável para:

* pontuação;
* palavra secreta;
* resultado das rodadas;
* jogador excluído da rodada;
* quantidade de tentativas;
* estado da partida;
* permissões do host;
* encerramento da partida.

Evite duplicação desnecessária de regras entre frontend e backend.

Utilize tipos fortes e estruturas que facilitem testes e manutenção.

3. BANCO DE PALAVRAS EM PORTUGUÊS

A aplicação deve possuir um banco de palavras em português brasileiro baseado no repositório:

[fserb/pt-br — Portuguese Dictionary Collection](https://github.com/fserb/pt-br/tree/master?utm_source=chatgpt.com)

O repositório contém um corpus linguístico abrangente em pt-BR, incluindo:

* léxico;
* verbos;
* conjugações;
* listas especializadas;
* palavras negativas;
* pontuações ICF.

A referência fornecida indica aproximadamente:

* 145.744 entradas lexicais;
* 4.023 verbos;
* 195.751 conjugações;
* 419.486 palavras com pontuação ICF.

O sistema deve incorporar esses dados à aplicação.

Não faça consultas ao GitHub em runtime para validar palavras. O repositório deve ser utilizado como fonte de dados para uma etapa de ingestão/importação, e as palavras relevantes devem ser persistidas no MongoDB.

4. INGESTÃO E NORMALIZAÇÃO DAS PALAVRAS

Crie um processo de importação das palavras do repositório para o MongoDB.

Esse processo deve:

* baixar/ler os arquivos necessários do repositório;
* identificar as diferentes fontes de palavras;
* normalizar os termos;
* remover duplicidades;
* normalizar Unicode;
* tratar corretamente acentos;
* preservar a forma original da palavra quando necessário;
* criar uma representação normalizada para comparação;
* identificar o tamanho da palavra;
* classificar a origem da palavra;
* registrar, quando disponível, a pontuação ICF;
* identificar palavras negativas/bloqueadas;
* permitir reexecutar o processo de importação sem gerar duplicatas.

A normalização precisa ser cuidadosamente projetada para português brasileiro.

Não remova acentos da palavra armazenada sem necessidade. Caso seja necessário comparar palavras sem acento, mantenha separadamente:

* `word`: forma original;
* `normalizedWord`: forma utilizada para comparação.

Exemplo conceitual:

`ação` → `word = "ação"` e `normalizedWord = "acao"`.

A regra exata de normalização deve ser centralizada em uma única função/utilidade compartilhada pelo sistema.

5. MODELAGEM DO BANCO DE PALAVRAS

Crie um modelo Prisma específico para o dicionário.

O modelo deve possuir, quando aplicável:

* identificador;
* palavra original;
* palavra normalizada;
* tamanho;
* origem;
* categoria/tipo;
* pontuação ICF;
* indicador de palavra negativa;
* timestamps;
* metadados necessários.

Crie índices apropriados para operações como:

* busca por palavra normalizada;
* busca por tamanho;
* busca por palavra + tamanho;
* filtragem de palavras negativas;
* seleção de palavras candidatas para partidas.

A modelagem deve considerar que o banco pode conter centenas de milhares de palavras.

Não carregue todo o dicionário para a memória da aplicação durante uma requisição.

6. VALIDAÇÃO DAS PALAVRAS

Quando o usuário escolher uma palavra secreta para uma partida multiplayer, a aplicação deve validar a palavra no servidor.

A palavra somente poderá ser aceita se:

1. possuir exatamente o número de letras definido pela sala;
2. existir no banco de palavras;
3. não estiver na lista de palavras negativas;
4. passar pela normalização e regras de validação;
5. for válida para o idioma português brasileiro utilizado pelo jogo.

A validação deve ocorrer no servidor.

Nunca confie apenas na validação feita pelo frontend.

Se o usuário tentar enviar uma palavra inexistente ou proibida, a API/Server Action deve rejeitar a operação e retornar um erro apropriado.

7. PALAVRAS DE TENTATIVA

O mesmo sistema de palavras deve ser utilizado para validar as tentativas dos jogadores durante as partidas.

Uma tentativa deve ser considerada válida quando:

* possui o tamanho correto;
* existe no dicionário;
* não pertence à lista de palavras negativas;
* está de acordo com as regras da partida.

O jogador não deve conseguir enviar palavras arbitrárias apenas manipulando o frontend.

8. SELEÇÃO E SORTEIO DE PALAVRAS

Para o modo multiplayer, cada jogador escolhe uma única palavra secreta.

A palavra precisa ser validada antes de ser persistida.

Quando a partida começar:

* todas as palavras submetidas devem estar válidas;
* o servidor deve controlar quais palavras estão disponíveis;
* cada rodada deve selecionar uma das palavras submetidas;
* o jogador responsável pela palavra sorteada deve ser identificado;
* esse jogador não participa daquela rodada;
* os demais jogadores jogam normalmente.

Se a utilização da pontuação ICF fizer sentido para alguma mecânica futura de seleção ou balanceamento, estruture o sistema para permitir isso, mas não altere a regra principal do multiplayer sem necessidade.

9. AUTENTICAÇÃO E CONTAS

Implemente autenticação utilizando Google Provider.

Cada usuário deve possuir:

* ID;
* nome;
* email;
* imagem/foto;
* preferências;
* estatísticas globais;
* `showInLeaderboard`;
* timestamps.

Proteja todas as áreas que exigem autenticação.

Um usuário não autenticado não deve conseguir:

* criar salas;
* entrar em partidas;
* enviar palavras;
* participar do ranking;
* manipular dados privados.

10. PRIVACIDADE NO RANKING

Implemente `showInLeaderboard`.

O usuário deve poder escolher nas configurações se deseja aparecer no ranking global.

Quando desativado:

* não exibir o usuário no ranking;
* não expor suas informações através do ranking;
* não permitir que o modal público de ranking revele seus dados.

A regra deve ser aplicada no servidor.

11. RANKING GLOBAL

Crie um ranking global.

O ranking deve permitir exibir:

* foto;
* nome;
* estatísticas;
* partidas;
* pontuação;
* média de pontuação.

Ao clicar em um jogador visível no ranking, abrir um modal contendo:

* foto;
* nome;
* total de partidas jogadas;
* pontuação média.

O ranking deve ser eficiente mesmo com uma grande quantidade de usuários.

12. CORE DO WORDLE

Implemente o jogo completo estilo Wordle.

Criar:

* grid de letras;
* teclado virtual;
* suporte ao teclado físico;
* estados das letras;
* animações;
* feedback visual;
* validação das tentativas;
* vitória;
* derrota;
* bloqueio após encerramento;
* estados de loading;
* estados de erro.

O jogo deve suportar:

* 4 letras;
* 5 letras;
* 6 letras.

A lógica de avaliação deve tratar corretamente letras repetidas.

Exemplo conceitual:

Se uma letra aparece apenas uma vez na palavra secreta, uma tentativa que contenha essa mesma letra várias vezes não pode marcar todas as ocorrências como corretas.

A implementação deve seguir uma lógica equivalente à avaliação correta do Wordle.

13. CRIAÇÃO DE SALAS

O jogador autenticado deve poder criar uma sala.

Durante a criação deve escolher:

* 4 letras;
* 5 letras;
* 6 letras.

Ao criar:

* gerar um ID único;
* persistir a sala no MongoDB;
* definir o usuário como host;
* definir o tamanho das palavras;
* definir o estado inicial da sala;
* gerar o link `/room/[roomId]`.

O link deve poder ser compartilhado.

14. ENTRADA NA SALA

Qualquer usuário autenticado que acessar:

`/room/[roomId]`

deve entrar diretamente no lobby caso:

* a sala exista;
* a sala ainda esteja aberta;
* a partida ainda não tenha começado;
* o usuário tenha permissão para participar.

Caso contrário, mostrar um estado apropriado informando que a sala não está disponível.

O servidor deve controlar a entrada.

Não confie apenas no estado visual do cliente.

15. LOBBY REALTIME

Criar um lobby realtime.

Quando um jogador entrar:

* os demais devem visualizar sua entrada sem precisar atualizar a página;
* atualizar a lista de jogadores;
* atualizar o contador;
* atualizar o estado da sala.

Quando um jogador sair:

* atualizar todos os clientes;
* manter o estado consistente.

O host deve visualizar o botão:

"Iniciar Partida"

Somente o host pode iniciar a partida.

16. SUBMISSÃO DA PALAVRA SECRETA

Antes do início da partida, cada jogador deve enviar exatamente uma palavra secreta.

A palavra:

* deve possuir o tamanho configurado na sala;
* deve existir no banco de palavras;
* não pode estar na lista de palavras negativas;
* deve ser validada no servidor;
* deve ser armazenada de maneira que não seja exposta aos demais jogadores.

Cada jogador só pode enviar uma palavra.

Depois da submissão:

* mostrar ao jogador que sua palavra foi recebida;
* impedir nova submissão;
* atualizar o lobby em realtime;
* não revelar a palavra para os outros participantes.

17. INÍCIO DA PARTIDA

O host somente deve conseguir iniciar a partida quando as condições necessárias forem atendidas.

Antes de iniciar:

* validar novamente o estado da sala;
* verificar os jogadores;
* verificar as palavras submetidas;
* garantir que cada jogador tenha uma palavra válida;
* congelar a lista de participantes da partida;
* criar o registro da partida;
* criar as rodadas necessárias.

A partir desse momento, alterações no lobby não devem corromper a partida.

18. RODADAS

A quantidade de rodadas deve ser exatamente igual ao número de jogadores participantes da partida.

Exemplo:

3 jogadores → 3 rodadas.

Em cada rodada:

1. selecionar uma palavra entre as palavras submetidas;
2. identificar o dono da palavra;
3. definir essa palavra como resposta da rodada;
4. colocar o dono da palavra em modo espectador;
5. permitir que os demais jogadores tentem descobrir a palavra;
6. registrar as tentativas;
7. calcular a pontuação;
8. finalizar a rodada;
9. avançar para a próxima rodada.

A seleção deve ser controlada pelo servidor.

Não permita que o cliente descubra antecipadamente qual palavra será utilizada.

19. MODO ESPECTADOR

O jogador cuja palavra estiver sendo utilizada na rodada deve entrar automaticamente em modo espectador.

Ele:

* não pode enviar tentativas;
* não pode pontuar na rodada como jogador;
* pode visualizar o estado permitido da partida;
* deve saber que está assistindo porque sua palavra foi selecionada.

Os demais jogadores devem continuar jogando normalmente.

20. SEGURANÇA DAS PALAVRAS SECRETAS

As palavras submetidas pelos jogadores são dados sensíveis dentro do contexto da partida.

Não envie para o frontend:

* todas as palavras secretas;
* a palavra de outro jogador antes da hora;
* informações internas do sorteio;
* respostas futuras;
* dados que permitam descobrir a resposta por inspeção do estado do cliente.

O servidor deve enviar somente o estado necessário para cada participante.

Analise possíveis formas de um usuário descobrir a resposta através de:

* Network;
* WebSocket;
* React state;
* payloads;
* APIs;
* cache;
* logs;
* dados serializados.

Corrija qualquer vazamento encontrado.

21. PONTUAÇÃO

Implemente um sistema de pontuação consistente para as partidas.

A pontuação deve:

* ser calculada no servidor;
* ser associada ao jogador;
* ser acumulada durante a partida;
* ser persistida;
* gerar o ranking final da partida.

Estruture o sistema para permitir ajustes futuros nas regras de pontuação sem reescrever o core do jogo.

22. PLACAR FINAL

Depois da última rodada:

* encerrar a partida;
* calcular pontuação final;
* ordenar os jogadores;
* identificar vencedor(es);
* persistir o resultado;
* atualizar estatísticas globais quando aplicável.

Exibir:

* colocação;
* nome;
* foto;
* pontuação;
* resultado geral da partida.

O placar deve representar somente aquela partida específica.

23. RECONEXÃO E CONCORRÊNCIA

O multiplayer deve ser projetado considerando:

* refresh da página;
* perda temporária de conexão;
* reconexão WebSocket;
* fechamento da aba;
* entrada simultânea;
* dois requests simultâneos;
* submissão duplicada;
* início duplicado da partida;
* tentativa duplicada;
* jogador desconectando durante uma rodada.

Não permita que eventos duplicados corrompam o estado.

O servidor deve ser a autoridade sobre o estado da partida.

Utilize operações atômicas, idempotência, versionamento de estado ou outras técnicas apropriadas quando necessário.

24. BANCO DE DADOS / PRISMA

Atualize o `schema.prisma` para MongoDB.

O schema deve contemplar, no mínimo:

* User;
* Account;
* Session, quando aplicável;
* Room;
* RoomParticipant;
* Game/Match;
* Round;
* SubmittedWord;
* MatchScore;
* Word/DictionaryEntry;
* estatísticas globais.

O modelo de palavras deve permitir armazenar:

* palavra;
* palavra normalizada;
* tamanho;
* origem;
* categoria;
* ICF;
* status de palavra negativa;
* timestamps.

Adicione índices apropriados.

O schema deve ser projetado considerando centenas de milhares de palavras.

25. IMPORTAÇÃO DO DICIONÁRIO

Crie um script/comando de ingestão separado do runtime da aplicação.

Exemplo conceitual:

`npm run dictionary:import`

O processo deve ser:

1. obter os arquivos do repositório;
2. processar os dados;
3. normalizar as palavras;
4. identificar palavras negativas;
5. calcular o tamanho;
6. extrair ICF quando disponível;
7. eliminar duplicatas;
8. inserir/atualizar no MongoDB;
9. produzir estatísticas da importação;
10. informar quantas palavras foram adicionadas, atualizadas, ignoradas e bloqueadas.

A importação deve ser idempotente.

Não crie duplicatas caso seja executada novamente.

26. SELEÇÃO DAS PALAVRAS UTILIZÁVEIS

A aplicação deve considerar somente palavras adequadas ao jogo.

Crie uma camada de domínio responsável por responder perguntas como:

* essa palavra existe?
* essa palavra possui o tamanho correto?
* essa palavra é negativa?
* essa palavra pode ser utilizada como resposta?
* essa palavra pode ser utilizada como tentativa?

Não espalhe essas regras pelo frontend.

Centralize a lógica.

27. LISTA DE PALAVRAS NEGATIVAS

Utilize as listas negativas disponíveis no repositório como fonte para bloquear palavras inadequadas.

Durante a importação:

* identificar palavras negativas;
* marcar ou excluir essas entradas;
* impedir que sejam utilizadas como palavras secretas;
* impedir que sejam utilizadas como tentativas, conforme a regra definida.

A aplicação deve permitir futuras atualizações da lista sem necessidade de alteração manual do código.

28. ICF

Quando disponível, armazene a pontuação ICF da palavra.

O ICF representa uma medida de frequência inversa no corpus.

O sistema deve preservar essa informação para permitir futuras funcionalidades de:

* seleção de palavras;
* balanceamento;
* dificuldade;
* estatísticas;
* análise do dicionário.

Não faça da pontuação ICF uma dependência obrigatória para a validação básica de uma palavra.

A existência da palavra no conjunto válido e sua ausência na lista negativa são as regras fundamentais de validação.

29. INTERFACE E TEMAS

Utilize Tailwind CSS e `next-themes`.

Implementar:

* modo claro;
* modo escuro;
* persistência da preferência;
* Header;
* navegação;
* perfil;
* configurações;
* ranking;
* criação de sala;
* lobby;
* jogo;
* modo espectador;
* placar.

A interface deve ser mobile first.

Garanta funcionamento adequado em:

* celulares;
* tablets;
* notebooks;
* monitores grandes.

Não aceite overflow horizontal, elementos cortados ou interfaces difíceis de utilizar em telas pequenas.

30. QUALIDADE VISUAL

Não aceite uma interface genérica ou inacabada.

Cada tela deve possuir:

* hierarquia visual clara;
* espaçamento consistente;
* tipografia adequada;
* estados de loading;
* estados vazios;
* estados de erro;
* estados de sucesso;
* feedback das ações;
* transições adequadas;
* boa acessibilidade;
* responsividade.

Utilize animações somente quando melhorarem a experiência.

Distribua um subagente específico para realizar revisão visual de cada tela.

Esse subagente deve ser extremamente rigoroso.

Ele deve verificar:

* alinhamento;
* espaçamento;
* consistência;
* responsividade;
* contraste;
* hierarquia;
* legibilidade;
* estados de interação;
* feedback;
* acessibilidade;
* qualidade geral da interface.

Se encontrar qualquer problema, deve solicitar correção e executar `/loop` novamente.

31. TESTES

Distribua subagentes para testar individualmente:

* autenticação;
* criação de conta;
* ranking;
* privacidade;
* criação de sala;
* entrada na sala;
* saída da sala;
* lobby;
* submissão de palavra;
* validação do dicionário;
* palavras negativas;
* palavras com acentos;
* palavras de 4 letras;
* palavras de 5 letras;
* palavras de 6 letras;
* avaliação de letras repetidas;
* início da partida;
* sorteio das rodadas;
* modo espectador;
* tentativas;
* pontuação;
* encerramento;
* placar;
* reconexão;
* refresh;
* desconexão;
* concorrência;
* segurança;
* responsividade.

Corrija todos os problemas encontrados.

Depois execute `/loop` novamente.

32. TESTES DO BANCO DE PALAVRAS

Crie testes específicos para garantir:

* importação correta;
* normalização;
* deduplicação;
* palavras acentuadas;
* palavras sem acento;
* palavras negativas;
* palavras inexistentes;
* tamanhos diferentes;
* buscas no MongoDB;
* idempotência da importação;
* consistência entre o dicionário e a validação do jogo.

O sistema deve ser capaz de lidar corretamente com centenas de milhares de entradas.

33. SEGURANÇA

Faça uma auditoria específica procurando:

* manipulação de pontuação;
* manipulação de estado;
* descoberta antecipada da palavra;
* alteração de participante;
* alteração de host;
* submissão duplicada;
* chamadas duplicadas;
* acesso a salas não autorizadas;
* acesso a partidas encerradas;
* abuso de Server Actions;
* abuso de WebSocket;
* exposição de dados privados;
* bypass da validação do dicionário.

Tudo que for considerado crítico deve ser corrigido antes da conclusão.

34. PERFORMANCE

Avalie:

* quantidade de queries;
* índices MongoDB;
* payloads WebSocket;
* renderizações React;
* tamanho dos bundles;
* Server Components;
* Client Components;
* caching;
* consultas ao dicionário;
* carregamento do ranking;
* processamento do lobby;
* reconexões.

Não carregue dados desnecessários no cliente.

Não carregue o dicionário inteiro para o frontend.

35. REVISÃO FINAL POR SUBAGENTES

Depois que todas as funcionalidades estiverem implementadas, distribua subagentes independentes para revisar o projeto inteiro.

Cada subagente deve analisar uma dimensão:

* arquitetura;
* TypeScript;
* Next.js;
* Prisma/MongoDB;
* dicionário;
* autenticação;
* segurança;
* realtime;
* multiplayer;
* regras do jogo;
* pontuação;
* UX;
* UI;
* acessibilidade;
* responsividade;
* performance;
* testes.

Os subagentes não devem simplesmente aprovar o projeto.

Eles devem procurar problemas.

Para cada problema encontrado:

1. registrar o problema;

2. implementar a correção;

3. executar os testes relacionados;

4. revisar novamente;

5. executar `/loop`.

6. CRITÉRIO DE CONCLUSÃO

Não considere o projeto concluído simplesmente porque:

* compila;
* inicia;
* uma partida funciona;
* o frontend está visualmente agradável.

Considere concluído somente depois de verificar:

* arquitetura;
* banco de dados;
* autenticação;
* segurança;
* dicionário;
* validação das palavras;
* multiplayer;
* realtime;
* reconexão;
* regras das rodadas;
* modo espectador;
* pontuação;
* ranking;
* responsividade;
* acessibilidade;
* performance;
* testes;
* qualidade visual.

O objetivo é entregar um produto real, coeso, seguro e preparado para produção.

37. ENTREGÁVEIS

Entregue:

1. Projeto Next.js completo.
2. Schema Prisma para MongoDB.
3. Configuração de autenticação Google.
4. Configuração do realtime.
5. Sistema de salas.
6. Lobby realtime.
7. Sistema de submissão de palavras.
8. Banco de palavras integrado ao MongoDB.
9. Script de importação do repositório `fserb/pt-br`.
10. Sistema de palavras negativas.
11. Validação de palavras no servidor.
12. Core Wordle para 4, 5 e 6 letras.
13. Gerenciador de rodadas.
14. Modo espectador.
15. Sistema de pontuação.
16. Placar final.
17. Ranking global.
18. Perfil e configurações.
19. Tema claro/escuro persistido.
20. Interface mobile first.
21. Tratamento de erros.
22. Loading states.
23. Reconexão realtime.
24. Proteções contra manipulação do cliente.
25. Testes automatizados para as regras críticas.
26. Documentação para desenvolvimento local.
27. Documentação para importar/atualizar o dicionário.
28. Documentação de configuração das variáveis de ambiente.
29. Documentação para deploy.

Não pare na primeira implementação funcional.

Use `/loop` continuamente durante o desenvolvimento.

Distribua subagentes especializados.

Faça cada subagente revisar criticamente seu trabalho.

Utilize um subagente visual independente para revisar todas as telas.

Utilize subagentes independentes para segurança, banco de dados, realtime, multiplayer, dicionário e performance.

Sempre que uma revisão encontrar um problema, corrija-o e execute `/loop` novamente.

Use o Ultracode.

O objetivo final é construir uma aplicação Wordle multiplayer em português brasileiro com qualidade de produto real: tecnicamente sólida, visualmente refinada, segura, performática, escalável e com um sistema de palavras local persistido no MongoDB, utilizando o repositório `fserb/pt-br` como fonte de dados e respeitando as regras de palavras válidas e negativas.
