// Projeto 10 — geração de XML (análise léxica e sintática).
// Uso: node xml.js <arquivo.jack>
// Gera um arquivo .xml com a árvore sintática na mesma pasta do .jack.
// Reaproveita o Scanner, o Parser e o XmlWriter (usado internamente pelo Parser).

const fs = require("fs");
const path = require("path");

const Scanner = require("./src/scanner/Scanner");
const Parser = require("./src/parser/Parser");

function main() {
  const entrada = process.argv[2];
  if (!entrada) {
    console.error("Uso: node xml.js <arquivo.jack>");
    process.exitCode = 1;
    return;
  }

  const caminho = path.resolve(entrada);
  if (!fs.existsSync(caminho) || !fs.statSync(caminho).isFile()) {
    console.error(`Erro: o arquivo "${entrada}" não existe.`);
    process.exitCode = 1;
    return;
  }
  if (path.extname(caminho).toLowerCase() !== ".jack") {
    console.error(`Erro: "${entrada}" não é um arquivo .jack.`);
    process.exitCode = 1;
    return;
  }

  const saida = path.join(
    path.dirname(caminho),
    path.basename(caminho, path.extname(caminho)) + ".xml"
  );

  try {
    const codigo = fs.readFileSync(caminho, "utf8");
    const tokens = new Scanner(codigo).tokenize();
    const xml = new Parser(tokens).parse();
    fs.writeFileSync(saida, xml + "\n", "utf8");
    console.log(`XML gerado com sucesso: ${path.join(path.dirname(entrada), path.basename(saida))}`);
  } catch (erro) {
    console.error(`Erro ao gerar XML de "${entrada}": ${erro.message}`);
    process.exitCode = 1;
  }
}

main();
