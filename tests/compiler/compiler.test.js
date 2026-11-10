const test = require('node:test');
const assert = require('node:assert/strict');
const Scanner = require('../../src/scanner/Scanner');
const CompilationEngine = require('../../src/compiler/CompilationEngine');
const compile = source => new CompilationEngine(new Scanner(source).tokenize()).parse();

test('commit 01 permanece: variáveis locais e retorno', () => {
  assert.equal(compile('class Main { function int add(int a, int b) { var int x; let x = a + b; return x; } }'),
    'function Main.add 1\npush argument 0\npush argument 1\nadd\npop local 0\npush local 0\nreturn\n');
});
test('commit 01 permanece: retorno vazio empilha zero', () => {
  assert.equal(compile('class Main { function void f() { return; } }'), 'function Main.f 0\npush constant 0\nreturn\n');
});
test('if e else geram saltos, labels e ambas as ramificações', () => {
  const vm = compile('class Main { function void f(boolean b) { if (b) { do Output.printInt(1); } else { do Output.printInt(2); } return; } }');
  assert.match(vm, /if-goto Main\.f\$IF_TRUE0/);
  assert.match(vm, /label Main\.f\$IF_FALSE1/);
  assert.match(vm, /label Main\.f\$IF_END2/);
  assert.equal((vm.match(/call Output\.printInt 1/g) || []).length, 2);
  assert.equal((vm.match(/pop temp 0/g) || []).length, 2);
});
test('if sem else não cria bloco extra', () => {
  const vm = compile('class Main { function void f() { if (true) { return; } return; } }');
  assert.match(vm, /label Main\.f\$IF_FALSE1/);
});
test('while gera loop com condição invertida', () => {
  const vm = compile('class Main { function void f() { var int i; let i = 0; while (i < 3) { let i = i + 1; } return; } }');
  assert.match(vm, /label Main\.f\$WHILE_EXP0[\s\S]*lt\nnot\nif-goto Main\.f\$WHILE_END1/);
  assert.match(vm, /goto Main\.f\$WHILE_EXP0\nlabel Main\.f\$WHILE_END1/);
});
test('do descarta retorno da função', () => {
  const vm = compile('class Main { function void f() { do Output.printInt(3); return; } }');
  assert.match(vm, /push constant 3\ncall Output\.printInt 1\npop temp 0/);
});
test('chamada de função da própria classe, declarada depois', () => {
  const vm = compile('class Main { function int a() { return b(7); } function int b(int x) { return x; } }');
  assert.match(vm, /function Main\.a 0\npush constant 7\ncall Main\.b 1\nreturn/);
});
test('erros e escopo do commit 03 ainda não disponibilizados', () => {
  assert.throws(() => compile('class Main { function void f() { let x = 1; return; } }'), /não declarada/);
  assert.throws(() => compile('class Main { method void m() { return; } }'), /commit 03/);
  assert.throws(() => compile('class Main { function int f(Array a) { return a[0]; } }'), /commit 03/);
  assert.throws(() => compile('class Main { function void f() { do Output.printString("Oi"); return; } }'), /commit 03/);
});