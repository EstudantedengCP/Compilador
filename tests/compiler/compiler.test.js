const test = require('node:test');
const assert = require('node:assert/strict');
const Scanner = require('../../src/scanner/Scanner');
const CompilationEngine = require('../../src/compiler/CompilationEngine');

function compile(code) {
  return new CompilationEngine(new Scanner(code).tokenize()).parse();
}

test('função com parâmetros, variável local e expressão', () => {
  const source = 'class Main { function int add(int a, int b) { var int x; let x = a + b; return x; } }';
  assert.equal(compile(source),
    'function Main.add 1\npush argument 0\npush argument 1\nadd\npop local 0\npush local 0\nreturn\n');
});

test('retorno void empilha valor 0', () => {
  assert.equal(compile('class Main { function void test() { return; } }'),
    'function Main.test 0\npush constant 0\nreturn\n');
});

test('não aceita variável não declarada', () => {
  assert.throws(() => compile('class Main { function void f() { let x = 1; return; } }'),
    /não declarada/);
});

test('rejeita recursos reservados para as próximas etapas', () => {
  assert.throws(() => compile('class Main { function void f() { while (true) { return; } return; } }'),
    /próximas etapas/);
});
