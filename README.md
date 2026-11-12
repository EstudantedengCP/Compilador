Integrantes do grupo

Integrante 1: Lucas Emanoel Amaral Gomes — Matrícula: 20250071250

Integrante 2: JOSE AUGUSTO SANTOS LOPES — Matrícula: 20260060115




# Compilador Jack — Analisador Léxico, Sintático e Geração XML

## Sobre o projeto

Este repositório contém o desenvolvimento de um compilador para a linguagem Jack, como parte do Projeto 10 do curso Nand2Tetris.

O projeto é dividido em duas partes principais:

- **Analisador léxico (Scanner):** responsável por identificar e classificar os tokens do código Jack.
- **Analisador sintático (Parser):** responsável por reconhecer as estruturas da linguagem e gerar uma representação em XML.

Na continuação (Projeto 11), o repositório também inclui o **JackCompiler**, que gera código VM a partir dos programas Jack (`src/compiler/`).

## Minha contribuição — Parser e XmlWriter

Minha responsabilidade no projeto foi desenvolver o analisador sintático e a geração de XML.


### Funcionalidades implementadas

- Leitura e navegação pelos tokens.
- Reconhecimento de classes e declarações de variáveis.
- Análise de construtores, funções e métodos.
- Reconhecimento de parâmetros e variáveis locais.
- Processamento dos comandos `let`, `if`, `while`, `do` e `return`.
- Análise de expressões e termos.
- Geração de XML estruturado.
- Tratamento de caracteres especiais no XML.
- Identificação de erros sintáticos.


## Minha contribuição — Scanner e integração

Minha responsabilidade no projeto foi desenvolver o analisador léxico (Scanner) da linguagem Jack, implementar testes de validação e realizar a integração com o Parser e o XmlWriter.


### Funcionalidades implementadas

- Reconhecimento de palavras reservadas (keywords) da linguagem Jack.

- Identificação de símbolos e operadores.

- Reconhecimento de identificadores.

- Leitura de constantes inteiras, com validação do limite de 0 a 32767.

- Reconhecimento de constantes de texto (strings).

- Ignorar comentários de linha (//) e de bloco (/* ... */).

- Rastreamento de linhas e colunas dos tokens.

- Identificação de caracteres inválidos.

- Tratamento de strings e comentários de bloco não fechados.

- Geração de tokens compatíveis com o Parser.

- Integração dos componentes Scanner, Parser e XmlWriter.

### Testes realizados

Foram realizados testes de tokenização de programas Jack e de tratamento de erros léxicos.

Os testes verificaram o reconhecimento dos tokens e situações como números acima do limite permitido, strings não fechadas, comentários de bloco não fechados e caracteres inválidos.

A integração também foi testada com um programa Jack contendo declarações de variáveis, atribuições, chamadas de sub-rotinas e retorno, gerando sua representação XML.



## Estrutura do projeto

```text
Compilador/
├── src/
│   ├── scanner/
│   │   └── Scanner.js
│   ├── parser/
│   │   ├── Parser.js
│   │   └── XmlWriter.js
│   └── compiler/
│       ├── CompilationEngine.js
│       ├── SymbolTable.js
│       └── VMWriter.js
├── tests/
│   ├── scanner/
│   │   └── erros.test.js
│   ├── compiler/
│   │   └── compiler.test.js
│   └── parser/
│       ├── referencias/
│       ├── testes_avancados.js
│       ├── comparar_oficial.js
│       ├── validar_oficial.py
│       └── validar_todos.py
├── main.js
├── xml.js
├── teste.js
└── README.md
```

O arquivo `xml.js` integra o Scanner, o Parser e o XmlWriter para gerar a representação XML de um programa Jack (Projeto 10).

O arquivo `main.js` é o ponto de entrada do JackCompiler: integra o Scanner e o CompilationEngine para gerar código VM a partir de um arquivo `.jack` ou de um diretório com arquivos `.jack` (Projeto 11).

## Como executar o projeto

Com o Node.js instalado, execute os comandos a partir da raiz do repositório.

### Executar o Scanner

```bash
node teste.js
```

### Projeto 10 — gerar XML (análise léxica e sintática)

```bash
node xml.js Main.jack
```

O programa recebe um arquivo `.jack`, realiza a análise léxica e sintática e gera um arquivo XML com a árvore de análise sintática, na mesma pasta do arquivo de entrada.

**Arquivo de entrada:** `Main.jack`

**Arquivo de saída:** `Main.xml`

Em caso de erro léxico ou sintático, a mensagem é exibida e o programa termina com código de saída 1.

### Projeto 11 — compilar para código VM

```bash
node main.js <arquivo.jack | diretório>
```

O programa aceita um único arquivo `.jack` ou um diretório. Em um diretório, compila apenas os arquivos `.jack` do primeiro nível daquela pasta (subpastas não são percorridas). Cada arquivo é compilado individualmente e o `.vm` correspondente é salvo na mesma pasta do `.jack`.

Exemplos de execução:

```bash
node main.js Main.jack     # gera Main.vm
node main.js pasta/        # gera um .vm para cada .jack da pasta
```

Para cada arquivo é exibido `OK` ou `ERRO` com a mensagem do erro, seguido de um resumo. Se algum arquivo falhar, os demais continuam sendo compilados e o programa termina com código de saída 1.

### Testes do compilador (código VM)

```bash
node --test tests/compiler/compiler.test.js
```

### Recursos implementados no compilador VM (Projeto 11)

A geração de código VM contempla:

- **Construtores:** alocação de memória com `Memory.alloc` e inicialização de `pointer 0`.
- **Métodos:** argumento implícito `this` e inicialização do segmento `pointer 0`.
- **Chamadas de sub-rotinas:** chamadas a métodos por meio de variáveis-objeto e chamadas internas à própria classe.
- **Arrays:** leitura e atribuição usando `pointer 1` e `that 0`.
- **Strings:** criação com `String.new` e preenchimento com `String.appendChar`.

O comando principal continua sendo `node main.js`, tanto para um arquivo quanto para um diretório. Não é necessário um segundo executável de compilação VM.

## Testes e validação

Foram realizados testes para verificar o reconhecimento dos tokens, a análise sintática, a geração de XML e o tratamento de entradas inválidas.

Execute os comandos a partir da raiz do projeto.

**Observação sobre a validação do SquareGame:** dos sete casos comparados, seis apresentaram equivalência estrutural com os XMLs de referência. No caso `Square/SquareGame.xml`, foi identificada uma incompatibilidade entre o arquivo de tokens (`SquareGameT.xml`) e a árvore sintática de referência (`SquareGame.xml`), incluindo valores diferentes (`81` e `113`). O XML produzido pelo Parser preservou os 313 tokens de entrada, na mesma ordem, e foi confirmado como bem-formado. A divergência permanece registrada e não foi contabilizada como teste aprovado.

### Testes do Scanner

Para executar os testes de erros léxicos:

```bash
node tests/scanner/erros.test.js
```

Os quatro testes foram aprovados, verificando números acima do limite permitido, strings não fechadas, comentários de bloco não fechados e caracteres inválidos.

### Testes do Parser

```bash
node tests/parser/testes_avancados.js
```

Foram executados oito testes avançados, todos aprovados.

### Validação com referências oficiais

```bash
python tests/parser/validar_todos.py
```

A validação requer Python 3 e acesso à internet para obter os arquivos de referência, quando necessário.

Na validação realizada, seis dos sete casos foram aprovados.

O caso `Square/SquareGame.xml` apresentou uma diferença: o arquivo de entrada `SquareGameT.xml` possui 313 tokens, enquanto o XML oficial de referência contém 356 tokens.

O Parser preservou os 313 tokens recebidos, indicando uma incompatibilidade entre os arquivos utilizados na comparação.

Essa diferença permanece documentada para investigação.

## Histórico de desenvolvimento — Parser e XmlWriter

O desenvolvimento da minha parte foi organizado em quatro etapas:

1. **Etapa 1:** estrutura inicial do Parser e XmlWriter.
2. **Etapa 2:** implementação de declarações, sub-rotinas e comandos.
3. **Etapa 3:** ampliação da análise sintática e inclusão dos testes.
4. **Etapa 4:** validação final, comparação com exemplos oficiais e documentação.




## Desafios enfrentados durante a unidade

Durante o desenvolvimento do compilador Jack, enfrentamos desafios relacionados à análise léxica, à análise sintática e à integração dos componentes.

Um dos principais desafios foi implementar o Scanner para reconhecer corretamente palavras reservadas, identificadores, símbolos e constantes, além de tratar erros como strings não fechadas, comentários incompletos e valores inteiros inválidos.

Na implementação do Parser, foi necessário compreender a gramática da linguagem Jack e aplicar a técnica de análise descendente recursiva (*recursive descent parsing*), garantindo o reconhecimento correto de declarações, comandos e expressões.

Outro desafio foi integrar o Scanner ao Parser e ao XmlWriter, permitindo que um arquivo `.jack` fosse processado e convertido em um arquivo `.xml` com a estrutura exigida pelo Nand2Tetris.

Durante a validação, utilizamos testes automatizados e comparações com arquivos oficiais. Identificamos uma divergência no exemplo `SquareGame`, relacionada à diferença entre os tokens da entrada utilizada e os presentes no XML de referência. Essa situação foi documentada para investigação.

Esses desafios contribuíram para o aprendizado sobre compiladores, organização modular, tratamento de erros, testes automatizados e versionamento com Git e GitHub.

## Tecnologias utilizadas

- JavaScript
- Node.js
- Python 3
- XML
- Git e GitHub
- Visual Studio Code

### Observação sobre o repositório

Como os integrantes do grupo não participaram da primeira etapa da atividade, foi necessário iniciar o desenvolvimento em um novo repositório.

Dessa forma, o Scanner e o Parser foram desenvolvidos e integrados neste projeto, garantindo o funcionamento conjunto dos componentes e o atendimento aos requisitos técnicos da atividade.

## Referência

Projeto educacional [Nand2Tetris](https://www.nand2tetris.org/), Projeto 10 — Compiler I: Syntax Analysis.