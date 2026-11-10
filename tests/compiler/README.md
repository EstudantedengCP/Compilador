# Projeto 11 — Geração de VM

Esta etapa acrescenta a compilação de Jack para VM sem alterar o Parser XML do Projeto 10.

## Arquivos

- `src/compiler/CompilationEngine.js`: reconhece a gramática Jack e emite VM, reutilizando a base de navegação e validação de `src/parser/Parser.js`.
- `src/compiler/SymbolTable.js`: resolve variáveis por escopo e segmento VM.
- `src/compiler/VMWriter.js`: escreve instruções VM.
- `tests/compiler/compiler.test.js`: testa os recursos do Projeto 11, usando o Scanner existente.
- `compile_vm.js`: comando de compilação de um arquivo Jack para VM.

## Como executar

A partir da raiz do repositório, com Node.js instalado:

```bash
node --test tests/compiler/compiler.test.js
node compile_vm.js Main.jack Main.vm
```

O comando `node main.js Main.jack Main.xml` continua sendo a interface existente para saída XML.

## Escopo dos testes

As oito verificações cobrem variáveis, expressões, `if/else`, `while`, chamadas `do`, métodos, construtores, arrays, strings e erros básicos. Esses testes são unitários/de integração com o Scanner; a execução dos programas oficiais do Projeto 11 no VM Emulator é uma validação adicional, ainda não documentada como concluída.

## Integração

O Scanner retorna `{ type, value, line, column }`. A CompilationEngine recebe o array de tokens e retorna o texto VM ao chamar `parse()`. O Parser XML original não precisa ser substituído.
