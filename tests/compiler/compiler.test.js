const test = require('node:test');
const assert = require('node:assert/strict');
const Scanner = require('../../src/scanner/Scanner');
const CompilationEngine = require('../../src/compiler/CompilationEngine');
const compile = source => new CompilationEngine(new Scanner(source).tokenize()).parse();

test('função, variáveis locais, expressão e return', () => {
  assert.equal(compile('class Main { function int add(int a, int b) { var int x; let x = a + b; return x; } }'),
    'function Main.add 1\npush argument 0\npush argument 1\nadd\npop local 0\npush local 0\nreturn\n');
});
test('if / else emite labels e saltos únicos', () => {
  const vm = compile('class Main { function void f(boolean b) { if (b) { do Output.printInt(1); } else { do Output.printInt(2); } return; } }');
  assert.match(vm, /if-goto Main\.f\$IF_TRUE0/);
  assert.match(vm, /label Main\.f\$IF_FALSE1/);
  assert.match(vm, /label Main\.f\$IF_END2/);
  assert.equal(vm.match(/call Output\.printInt 1/g).length, 2);
  assert.match(vm, /pop temp 0/);
});
test('while emite loop, not, goto e label', () => {
  const vm = compile('class Main { function void f() { var int i; let i = 0; while (i < 3) { let i = i + 1; } return; } }');
  assert.match(vm, /label Main\.f\$WHILE_EXP0[\s\S]*lt\nnot\nif-goto Main\.f\$WHILE_END1/);
  assert.match(vm, /goto Main\.f\$WHILE_EXP0\nlabel Main\.f\$WHILE_END1/);
});
test('construtor aloca fields; métodos inicializam this', () => {
  const vm = compile('class Point { field int x, y; constructor Point new(int a) { let x = a; return this; } method int getX() { return x; } }');
  assert.match(vm, /function Point\.new 0\npush constant 2\ncall Memory\.alloc 1\npop pointer 0/);
  assert.match(vm, /pop this 0/);
  assert.match(vm, /function Point\.getX 0\npush argument 0\npop pointer 0\npush this 0\nreturn/);
});
test('chamadas de método do objeto e método local', () => {
  const vm = compile('class P { field int x; method int get() { return x; } method int twice() { return get() + get(); } function int other(P p) { return p.get(); } }');
  assert.equal((vm.match(/call P\.get 1/g) || []).length, 3);
  assert.match(vm, /function P\.other 0\npush argument 0\ncall P\.get 1\nreturn/);
});
test('arrays usam pointer 1 e that 0', () => {
  const vm = compile('class Main { function int f(Array a, int i) { let a[i] = 7; return a[i]; } }');
  assert.match(vm, /push argument 0\npush argument 1\nadd\npush constant 7\npop temp 0\npop pointer 1\npush temp 0\npop that 0/);
  assert.match(vm, /push argument 0\npush argument 1\nadd\npop pointer 1\npush that 0\nreturn/);
});
test('strings usam String.new e String.appendChar', () => {
  const vm = compile('class Main { function void f() { do Output.printString("Oi"); return; } }');
  assert.match(vm, /push constant 2\ncall String\.new 1\npush constant 79\ncall String\.appendChar 2\npush constant 105\ncall String\.appendChar 2\ncall Output\.printString 1/);
});
test('operadores e static; erros sintáticos', () => {
  const vm = compile('class Main { static int count; function int f() { let count = 8 * 2 / 4; return -count; } }');
  assert.match(vm, /call Math\.multiply 2\npush constant 4\ncall Math\.divide 2\npop static 0\npush static 0\nneg/);
  assert.throws(() => compile('class Main { function void f() { let x = 2; return; } }'), /não declarada/);
  assert.throws(() => compile('class Main { function void f() { return } }'), SyntaxError);
});

test('function não pode usar this nem acessar fields de instância', () => {
  assert.throws(() => compile('class A { function A f() { return this; } }'), /this não pode ser usado/);
  assert.throws(() => compile('class A { field int x; function int f() { return x; } }'), /não pode acessar o campo/);
  assert.throws(() => compile('class A { field int x; function void f() { let x = 1; return; } }'), /não pode modificar o campo/);
});

test('chamada qualificada de método da própria classe exige receptor', () => {
  assert.throws(() => compile('class A { method void m() { return; } function void f() { do A.m(); return; } }'), /exige um objeto receptor/);
});

test('chamada por objeto da própria classe só aceita sub-rotina method', () => {
  assert.throws(() => compile('class A { function void f() { return; } function void g(A a) { do a.f(); return; } }'), /não é método de instância/);
});

test('return vazio mantém zero como valor de retorno VM', () => {
  assert.equal(compile('class Main { function void f() { return; } }'),
    'function Main.f 0\npush constant 0\nreturn\n');
});

test('if sem else fecha o caminho falso sem salto de saída desnecessário', () => {
  const vm = compile('class Main { function void f() { if (true) { return; } return; } }');
  assert.match(vm, /label Main\.f\$IF_FALSE1/);
  assert.doesNotMatch(vm, /label Main\.f\$IF_END2/);
});

test('do descarta o valor retornado pela chamada', () => {
  const vm = compile('class Main { function void f() { do Output.printInt(3); return; } }');
  assert.match(vm, /push constant 3\ncall Output\.printInt 1\npop temp 0/);
});

test('chamada de function da própria classe declarada depois continua válida', () => {
  const vm = compile('class Main { function int a() { return b(7); } function int b(int x) { return x; } }');
  assert.match(vm, /function Main\.a 0\npush constant 7\ncall Main\.b 1\nreturn/);
});


test('chamadas qualificadas à própria classe rejeitam nomes inexistentes', () => {
  assert.throws(() => compile('class A { function void f() { do A.missing(); return; } }'), /sub-rotina não declarada/);
  assert.throws(() => compile('class A { function void f(A a) { do a.missing(); return; } }'), /sub-rotina não declarada/);
});

test('sub-rotinas duplicadas: duas functions com o mesmo nome', () => {
  assert.throws(() => compile('class A { function void f() { return; } function void f() { return; } }'),
    /sub-rotina duplicada: f/);
});

test('sub-rotinas duplicadas: dois methods com o mesmo nome', () => {
  assert.throws(() => compile('class A { method int m() { return 1; } method int m() { return 2; } }'),
    /sub-rotina duplicada: m/);
});

test('sub-rotinas duplicadas: function e method com o mesmo nome', () => {
  assert.throws(() => compile('class A { function void x() { return; } method void x() { return; } }'),
    /sub-rotina duplicada: x/);
  assert.throws(() => compile('class A { constructor A new() { return this; } function A new() { return null; } }'),
    /sub-rotina duplicada: new/);
});

test('sub-rotina duplicada informa linha e coluna da segunda declaração', () => {
  assert.throws(() => compile('class A {\n  function void f() { return; }\n  function void f() { return; }\n}'),
    /linha 3, coluna 17\): sub-rotina duplicada: f/);
});

test('return: void com "return;" e não-void com expressão continuam válidos', () => {
  assert.equal(compile('class A { function void f() { return; } }'), 'function A.f 0\npush constant 0\nreturn\n');
  assert.equal(compile('class A { function int g() { return 5; } }'), 'function A.g 0\npush constant 5\nreturn\n');
  assert.equal(compile('class A { method boolean h() { return true; } }'),
    'function A.h 0\npush argument 0\npop pointer 0\npush constant 0\nnot\nreturn\n');
});

test('return: "return;" em sub-rotina não-void é rejeitado', () => {
  assert.throws(() => compile('class A { function int f() { return; } }'), /deve retornar um valor do tipo int/);
  assert.throws(() => compile('class A { method boolean m() { return; } }'), /deve retornar um valor do tipo boolean/);
  assert.throws(() => compile('class A { function Array f() { return; } }'), /deve retornar um valor do tipo Array/);
});

test('return: "return expressão;" em sub-rotina void é rejeitado', () => {
  assert.throws(() => compile('class A { function void f() { return 1; } }'), /void f não pode retornar um valor/);
  assert.throws(() => compile('class A { method void m() { return this; } }'), /void m não pode retornar um valor/);
  assert.throws(() => compile('class A { function void f() { var int x; let x = 1; return x + 1; } }'), /void f não pode retornar um valor/);
});

test('return: validação usa o tipo da sub-rotina atual, inclusive em blocos aninhados', () => {
  assert.throws(() => compile('class A { function int f(boolean b) { if (b) { return; } return 1; } }'), /deve retornar um valor/);
  assert.throws(() => compile('class A { function void f() { while (true) { return 0; } return; } }'), /não pode retornar um valor/);
  // O tipo da primeira sub-rotina não vaza para a seguinte.
  assert.doesNotThrow(() => compile('class A { function int f() { return 1; } function void g() { return; } }'));
});

test('construtor: tipo de retorno igual ao nome da classe é aceito', () => {
  const vm = compile('class Point { constructor Point new() { return this; } }');
  assert.equal(vm, 'function Point.new 0\npush constant 0\ncall Memory.alloc 1\npop pointer 0\npush pointer 0\nreturn\n');
});

test('construtor: tipo de retorno diferente do nome da classe é rejeitado', () => {
  assert.throws(() => compile('class Point { constructor int new() { return this; } }'), /construtor deve retornar o tipo da classe Point, encontrado int/);
  assert.throws(() => compile('class Point { constructor void new() { return; } }'), /construtor deve retornar o tipo da classe Point, encontrado void/);
  assert.throws(() => compile('class Point { constructor Other new() { return this; } }'), /construtor deve retornar o tipo da classe Point, encontrado Other/);
});
