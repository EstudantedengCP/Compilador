// Testes do ponto de entrada main.js (entrada por arquivo ou diretório).
// Executa o main.js como processo separado, em pastas temporárias.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MAIN = path.join(__dirname, '..', '..', 'main.js');

const VALIDO = 'class Main { function void main() { do Output.printInt(1 + 2); return; } }\n';
const INVALIDO = 'class Ruim { function void f() { return } }\n';

function pastaTemp(arquivos = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jack-cli-'));
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    const destino = path.join(dir, nome);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, conteudo);
  }
  return dir;
}

function rodar(...args) {
  const r = spawnSync(process.execPath, [MAIN, ...args], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

test('arquivo .jack: gera o .vm com o mesmo nome na mesma pasta', () => {
  const dir = pastaTemp({ 'Main.jack': VALIDO });
  const r = rodar(path.join(dir, 'Main.jack'));
  assert.equal(r.code, 0);
  assert.match(r.out, /OK\s+.*Main\.jack -> .*Main\.vm/);
  assert.match(r.out, /1 de 1 arquivo\(s\) compilado\(s\) com sucesso/);
  assert.equal(fs.readFileSync(path.join(dir, 'Main.vm'), 'utf8'),
    'function Main.main 0\npush constant 1\npush constant 2\nadd\ncall Output.printInt 1\npop temp 0\npush constant 0\nreturn\n');
});

test('diretório: compila só os .jack do primeiro nível, um .vm por arquivo', () => {
  const dir = pastaTemp({
    'Main.jack': VALIDO,
    'Game.jack': 'class Game { function int f() { return 7; } }\n',
    'Player.jack': 'class Player { field int x; constructor Player new() { let x = 1; return this; } }\n',
    'notas.txt': 'não é jack',
    'sub/Escondido.jack': VALIDO,
  });
  const r = rodar(dir);
  assert.equal(r.code, 0);
  assert.match(r.out, /3 de 3 arquivo\(s\) compilado\(s\) com sucesso/);
  assert.deepEqual(fs.readdirSync(dir).filter(n => n.endsWith('.vm')).sort(), ['Game.vm', 'Main.vm', 'Player.vm']);
  assert.equal(fs.existsSync(path.join(dir, 'sub', 'Escondido.vm')), false, 'não deve descer em subpastas');
  assert.match(fs.readFileSync(path.join(dir, 'Player.vm'), 'utf8'), /^function Player\.new 0\npush constant 1\ncall Memory\.alloc 1/);
});

test('diretório: um arquivo com erro não impede os demais e o código de saída é 1', () => {
  const dir = pastaTemp({ 'Main.jack': VALIDO, 'Ruim.jack': INVALIDO });
  const r = rodar(dir);
  assert.equal(r.code, 1);
  assert.match(r.err, /ERRO\s+.*Ruim\.jack: Erro sintático \(linha 1, coluna 41\)/);
  assert.match(r.out, /OK\s+.*Main\.jack/);
  assert.match(r.out, /1 de 2 arquivo\(s\) compilado\(s\) com sucesso/);
  assert.equal(fs.existsSync(path.join(dir, 'Main.vm')), true);
  assert.equal(fs.existsSync(path.join(dir, 'Ruim.vm')), false, 'arquivo com erro não gera .vm');
});

test('erros de entrada: sem argumento, caminho inexistente, extensão errada, pasta sem .jack', () => {
  const semArg = rodar();
  assert.equal(semArg.code, 1);
  assert.match(semArg.err, /Uso: node main\.js <arquivo\.jack \| diretório>/);

  const dir = pastaTemp({ 'notas.txt': 'x' });
  const inexistente = rodar(path.join(dir, 'NaoExiste.jack'));
  assert.equal(inexistente.code, 1);
  assert.match(inexistente.err, /não existe/);

  const txt = rodar(path.join(dir, 'notas.txt'));
  assert.equal(txt.code, 1);
  assert.match(txt.err, /não é um arquivo \.jack/);

  const vazia = rodar(dir);
  assert.equal(vazia.code, 1);
  assert.match(vazia.err, /nenhum arquivo \.jack encontrado/);
  assert.deepEqual(fs.readdirSync(dir), ['notas.txt'], 'nenhum arquivo deve ser criado');
});

test('caminho com barra final e caminho relativo funcionam', () => {
  const dir = pastaTemp({ 'Main.jack': VALIDO });
  assert.equal(rodar(dir + path.sep).code, 0);
  const r = spawnSync(process.execPath, [MAIN, '.'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /OK\s+Main\.jack -> Main\.vm/);
});
