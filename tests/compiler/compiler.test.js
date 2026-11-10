const test = require('node:test');
const assert = require('node:assert/strict');
const Scanner = require('../../src/scanner/Scanner');
const CompilationEngine = require('../../src/compiler/CompilationEngine');

function compile(source) {
  return new CompilationEngine(new Scanner(source).tokenize()).parse();
}

test('função, variáveis locais, expressão e retorno', () => {
  assert.equal(
    compile('class Main { function int add(int a, int b) { var int x; let x = a + b; return x; } }'),
    'function Main.add 1\npush argument 0\npush argument 1\nadd\npop local 0\npush local 0\nreturn\n'
  );
});

test('if/else: labels e saltos distintos', () => {
  const vm = compile('class Main { function void f(boolean b) { if (b) { do Output.printInt(1); } else { do Output.printInt(2); } return; } }');
  assert.match(vm, /if-goto Main\.f\$IF_TRUE0/);
  assert.match(vm, /label Main\.f\$IF_FALSE1/);
  assert.match(vm, /label Main\.f\$IF_END2/);
  assert.equal((vm.match(/call Output\.printInt 1/g) || []).length, 2);
  assert.match(vm, /pop temp 0/);
});

test('while: teste, salto de retorno e saída', () => {
  const vm = compile('class Main { function void f() { var int i; let i = 0; while (i < 3) { let i = i + 1; } return; } }');
  assert.match(vm, /label Main\.f\$WHILE_EXP0[\s\S]*lt\nnot\nif-goto Main\.f\$WHILE_END1/);
  assert.match(vm, /goto Main\.f\$WHILE_EXP0\nlabel Main\.f\$WHILE_END1/);
});

test('construtor aloca fields; método inicializa this', () => {
  const vm = compile('class Point { field int x, y; constructor Point new(int a) { let x = a; return this; } method int getX() { return x; } }');
  assert.match(vm, /function Point\.new 0\npush constant 2\ncall Memory\.alloc 1\npop pointer 0/);
  assert.match(vm, /pop this 0/);
  assert.match(vm, /function Point\.getX 0\npush argument 0\npop pointer 0\npush this 0\nreturn/);
});

test('chamada de método local e em variável objeto', () => {
  const vm = compile('class P { field int x; method int get() { return x; } method int twice() { return get() + get(); } function int other(P p) { return p.get(); } }');
  assert.equal((vm.match(/call P\.get 1/g) || []).length, 3);
  assert.match(vm, /function P\.other 0\npush argument 0\ncall P\.get 1\nreturn/);
});

test('arrays: leitura e escrita com that', () => {
  const vm = compile('class Main { function int f(Array a, int i) { let a[i] = 7; return a[i]; } }');
  assert.match(vm, /push argument 0\npush argument 1\nadd\npush constant 7\npop temp 0\npop pointer 1\npush temp 0\npop that 0/);
  assert.match(vm, /push argument 0\npush argument 1\nadd\npop pointer 1\npush that 0\nreturn/);
});

test('strings: criação e adição de caracteres', () => {
  const vm = compile('class Main { function void f() { do Output.printString("Oi"); return; } }');
  assert.match(vm, /push constant 2\ncall String\.new 1\npush constant 79\ncall String\.appendChar 2\npush constant 105\ncall String\.appendChar 2\ncall Output\.printString 1/);
});

test('operadores, static e erros sintáticos', () => {
  const vm = compile('class Main { static int count; function int f() { let count = 8 * 2 / 4; return -count; } }');
  assert.match(vm, /call Math\.multiply 2\npush constant 4\ncall Math\.divide 2\npop static 0\npush static 0\nneg/);
  assert.throws(() => compile('class Main { function void f() { let x = 2; return; } }'), /não declarada/);
  assert.throws(() => compile('class Main { function void f() { return } }'), SyntaxError);
});
