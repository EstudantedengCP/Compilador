// Uso: node compile_vm.js caminho/Classe.jack [caminho/Classe.vm]
const fs = require('node:fs');
const path = require('node:path');
const Scanner = require('./src/scanner/Scanner');
const CompilationEngine = require('./src/compiler/CompilationEngine');

const entrada = process.argv[2];
if (!entrada || path.extname(entrada).toLowerCase() !== '.jack') {
  console.error('Uso: node compile_vm.js Classe.jack [Classe.vm]');
  process.exit(1);
}
const saida = process.argv[3] || entrada.replace(/\.jack$/i, '.vm');
try {
  const fonte = fs.readFileSync(entrada, 'utf8');
  const tokens = new Scanner(fonte).tokenize();
  const vm = new CompilationEngine(tokens).parse();
  fs.writeFileSync(saida, vm, 'utf8');
  console.log('Código VM gerado:', saida);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
