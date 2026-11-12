// JackCompiler — entrada por arquivo ou diretório.
// Uso: node main.js <arquivo.jack | diretório>
// Gera um arquivo .vm ao lado de cada .jack compilado.

const fs = require("fs");
const path = require("path");

const Scanner = require("./src/scanner/Scanner");
const CompilationEngine = require("./src/compiler/CompilationEngine");

function compilarArquivo(arquivoJack) {
  const codigo = fs.readFileSync(arquivoJack, "utf8");
  const tokens = new Scanner(codigo).tokenize();
  const vm = new CompilationEngine(tokens).parse();

  const arquivoVm = path.join(
    path.dirname(arquivoJack),
    path.basename(arquivoJack, path.extname(arquivoJack)) + ".vm"
  );
  fs.writeFileSync(arquivoVm, vm, "utf8");
  return arquivoVm;
}

// Caminho curto para exibição: relativo ao diretório atual quando possível.
function exibir(caminho) {
  const relativo = path.relative(process.cwd(), caminho);
  return relativo && !relativo.startsWith("..") && !path.isAbsolute(relativo) ? relativo : caminho;
}

function listarArquivosJack(diretorio) {
  return fs
    .readdirSync(diretorio, { withFileTypes: true })
    .filter((item) => item.isFile() && path.extname(item.name).toLowerCase() === ".jack")
    .map((item) => path.join(diretorio, item.name))
    .sort();
}

function main() {
  // 1. Receber o caminho informado no terminal
  const entrada = process.argv[2];
  if (!entrada) {
    console.error("Uso: node main.js <arquivo.jack | diretório>");
    process.exitCode = 1;
    return;
  }

  // 2. Verificar se o caminho existe
  const caminho = path.resolve(entrada);
  if (!fs.existsSync(caminho)) {
    console.error(`Erro: o caminho "${entrada}" não existe.`);
    process.exitCode = 1;
    return;
  }

  // 3. Identificar se é arquivo ou diretório
  let arquivos;
  const info = fs.statSync(caminho);
  if (info.isDirectory()) {
    // 4. Localizar apenas os arquivos .jack da pasta
    arquivos = listarArquivosJack(caminho);
    if (arquivos.length === 0) {
      console.error(`Erro: nenhum arquivo .jack encontrado em "${entrada}".`);
      process.exitCode = 1;
      return;
    }
  } else if (info.isFile()) {
    if (path.extname(caminho).toLowerCase() !== ".jack") {
      console.error(`Erro: "${entrada}" não é um arquivo .jack.`);
      process.exitCode = 1;
      return;
    }
    arquivos = [caminho];
  } else {
    console.error(`Erro: "${entrada}" não é um arquivo nem um diretório.`);
    process.exitCode = 1;
    return;
  }

  // 5. Compilar cada arquivo individualmente
  // 6. Salvar o .vm na mesma pasta do .jack
  // 7. Exibir mensagens de sucesso ou erro
  let falhas = 0;
  for (const arquivo of arquivos) {
    const nome = exibir(arquivo);
    try {
      const saida = compilarArquivo(arquivo);
      console.log(`OK    ${nome} -> ${exibir(saida)}`);
    } catch (erro) {
      falhas++;
      console.error(`ERRO  ${nome}: ${erro.message}`);
    }
  }

  const sucesso = arquivos.length - falhas;
  console.log(`\n${sucesso} de ${arquivos.length} arquivo(s) compilado(s) com sucesso.`);
  if (falhas > 0) process.exitCode = 1;
}

main();
