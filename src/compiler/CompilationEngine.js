const Parser = require('../parser/Parser');
const SymbolTable = require('./SymbolTable');
const VMWriter = require('./VMWriter');

// Reaproveita a navegação e a validação de tokens do Parser XML.
// As produções são sobrescritas para emitir código VM.
class CompilationEngine extends Parser {
  constructor(tokens, writer = new VMWriter()) {
    super(tokens);
    this.vm = writer;
    this.symbols = new SymbolTable();
    this.className = '';
    this.subroutineName = '';
    this.currentSubroutineKind = '';
    this.labelIndex = 0;
    this.classSubroutineKinds = new Map();
  }

  consume(expected) {
    const token = this.peek();
    if (!token) this.fail(`esperado ${expected}`);
    if (!this._isValid(token, expected)) this.fail(`esperado ${expected}, encontrado ${token.value}`);
    return this.advance();
  }
  type() {
    if (this.match('int', 'char', 'boolean') || this.matchType('identifier')) return this.advance().value;
    this.fail('tipo esperado');
  }
  parse() {
    this.class();
    if (this.peek()) this.fail(`token extra: ${this.peek().value}`);
    return this.vm.toString();
  }
  class() {
    this.consume('class');
    this.className = this.consume('identifier').value;
    this.consume('{');
    this.symbols.startClass();
    this.classSubroutineKinds.clear();
    this.labelIndex = 0;
    while (this.match('static', 'field')) this.classVarDec();
    this.scanSubroutineKinds();
    while (this.match('constructor', 'function', 'method')) this.subroutineDec();
    this.consume('}');
  }
  scanSubroutineKinds() {
    let depth = 0;
    for (let i = this.pos; i < this.tokens.length; i++) {
      const token = this.tokens[i];
      if (token.value === '{') depth++;
      if (token.value === '}') {
        if (depth === 0) break;
        depth--;
      }
      if (depth === 0 && ['constructor', 'function', 'method'].includes(token.value)) {
        const name = this.tokens[i + 2];
        if (name?.type === 'identifier') this.classSubroutineKinds.set(name.value, token.value);
      }
    }
  }
  classVarDec() {
    const kind = this.advance().value;
    const type = this.type();
    this.symbols.define(this.consume('identifier').value, type, kind);
    while (this.match(',')) {
      this.consume(',');
      this.symbols.define(this.consume('identifier').value, type, kind);
    }
    this.consume(';');
  }
  subroutineDec() {
    const kind = this.advance().value;
    this.currentSubroutineKind = kind;
    this.symbols.startSubroutine();
    if (kind === 'method') this.symbols.define('this', this.className, 'argument');
    if (this.match('void')) this.advance(); else this.type();
    this.subroutineName = this.consume('identifier').value;
    this.consume('(');
    this.parameterList();
    this.consume(')');
    this.subroutineBody();
  }
  parameterList() {
    if (this.match(')')) return;
    let type = this.type();
    this.symbols.define(this.consume('identifier').value, type, 'argument');
    while (this.match(',')) {
      this.consume(',');
      type = this.type();
      this.symbols.define(this.consume('identifier').value, type, 'argument');
    }
  }
  subroutineBody() {
    this.consume('{');
    while (this.match('var')) this.varDec();
    this.vm.writeFunction(`${this.className}.${this.subroutineName}`, this.symbols.varCount('var'));
    if (this.currentSubroutineKind === 'constructor') {
      this.vm.writePush('constant', this.symbols.varCount('field'));
      this.vm.writeCall('Memory.alloc', 1);
      this.vm.writePop('pointer', 0);
    } else if (this.currentSubroutineKind === 'method') {
      this.vm.writePush('argument', 0);
      this.vm.writePop('pointer', 0);
    }
    this.statements();
    this.consume('}');
  }
  varDec() {
    this.consume('var');
    const type = this.type();
    this.symbols.define(this.consume('identifier').value, type, 'var');
    while (this.match(',')) {
      this.consume(',');
      this.symbols.define(this.consume('identifier').value, type, 'var');
    }
    this.consume(';');
  }
  segment(symbol) {
    return { static: 'static', field: 'this', argument: 'argument', var: 'local' }[symbol.kind];
  }
  symbol(name) {
    const entry = this.symbols.resolve(name);
    if (!entry) this.fail(`variável não declarada: ${name}`);
    return entry;
  }
  pushVar(name) {
    const s = this.symbol(name);
    this.vm.writePush(this.segment(s), s.index);
  }
  popVar(name) {
    const s = this.symbol(name);
    this.vm.writePop(this.segment(s), s.index);
  }
  label(prefix) {
    return `${this.className}.${this.subroutineName}$${prefix}${this.labelIndex++}`;
  }
  statements() {
    while (this.match('let', 'if', 'while', 'do', 'return')) {
      if (this.match('let')) this.letStatement();
      else if (this.match('if')) this.ifStatement();
      else if (this.match('while')) this.whileStatement();
      else if (this.match('do')) this.doStatement();
      else this.returnStatement();
    }
  }
  letStatement() {
    this.consume('let');
    const name = this.consume('identifier').value;
    const array = this.match('[');
    if (array) {
      this.pushVar(name);
      this.consume('[');
      this.expression();
      this.consume(']');
      this.vm.writeArithmetic('add');
    }
    this.consume('=');
    this.expression();
    this.consume(';');
    if (array) {
      this.vm.writePop('temp', 0);
      this.vm.writePop('pointer', 1);
      this.vm.writePush('temp', 0);
      this.vm.writePop('that', 0);
    } else this.popVar(name);
  }
  ifStatement() {
    this.consume('if'); this.consume('('); this.expression(); this.consume(')');
    const yes = this.label('IF_TRUE');
    const no = this.label('IF_FALSE');
    const end = this.label('IF_END');
    this.vm.writeIf(yes);
    this.vm.writeGoto(no);
    this.vm.writeLabel(yes);
    this.consume('{'); this.statements(); this.consume('}');
    if (this.match('else')) {
      this.vm.writeGoto(end);
      this.vm.writeLabel(no);
      this.consume('else'); this.consume('{'); this.statements(); this.consume('}');
      this.vm.writeLabel(end);
    } else this.vm.writeLabel(no);
  }
  whileStatement() {
    const start = this.label('WHILE_EXP');
    const end = this.label('WHILE_END');
    this.vm.writeLabel(start);
    this.consume('while'); this.consume('('); this.expression(); this.consume(')');
    this.vm.writeArithmetic('not');
    this.vm.writeIf(end);
    this.consume('{'); this.statements(); this.consume('}');
    this.vm.writeGoto(start);
    this.vm.writeLabel(end);
  }
  doStatement() {
    this.consume('do');
    this.subroutineCall();
    this.consume(';');
    this.vm.writePop('temp', 0);
  }
  returnStatement() {
    this.consume('return');
    if (this.match(';')) this.vm.writePush('constant', 0);
    else this.expression();
    this.consume(';');
    this.vm.writeReturn();
  }
  expression() {
    this.term();
    while (this.match('+', '-', '*', '/', '&', '|', '<', '>', '=')) {
      const op = this.advance().value;
      this.term();
      const commands = { '+': 'add', '-': 'sub', '&': 'and', '|': 'or', '<': 'lt', '>': 'gt', '=': 'eq' };
      if (op === '*') this.vm.writeCall('Math.multiply', 2);
      else if (op === '/') this.vm.writeCall('Math.divide', 2);
      else this.vm.writeArithmetic(commands[op]);
    }
  }
  term() {
    const token = this.peek();
    if (!token) this.fail('termo esperado');
    if (['integerConstant', 'integer', 'int'].includes(token.type)) {
      const value = Number(this.advance().value);
      if (!Number.isInteger(value) || value < 0 || value > 32767)
        this.fail(`constante fora do intervalo: ${value}`);
      this.vm.writePush('constant', value);
      return;
    }
    if (['stringConstant', 'string'].includes(token.type)) {
      const value = String(this.advance().value);
      this.vm.writePush('constant', value.length);
      this.vm.writeCall('String.new', 1);
      for (const char of value) {
        const code = char.charCodeAt(0);
        if (code > 32767) this.fail('caractere de string fora do intervalo');
        this.vm.writePush('constant', code);
        this.vm.writeCall('String.appendChar', 2);
      }
      return;
    }
    if (this.match('true', 'false', 'null', 'this')) {
      const value = this.advance().value;
      if (value === 'true') {
        this.vm.writePush('constant', 0);
        this.vm.writeArithmetic('not');
      } else if (value === 'this') this.vm.writePush('pointer', 0);
      else this.vm.writePush('constant', 0);
      return;
    }
    if (this.match('(')) {
      this.consume('('); this.expression(); this.consume(')'); return;
    }
    if (this.match('-', '~')) {
      const op = this.advance().value;
      this.term();
      this.vm.writeArithmetic(op === '-' ? 'neg' : 'not');
      return;
    }
    if (this.matchType('identifier')) {
      const next = this.peek(1);
      if (next && ['(', '.'].includes(next.value)) {
        this.subroutineCall();
        return;
      }
      const name = this.consume('identifier').value;
      this.pushVar(name);
      if (this.match('[')) {
        this.consume('['); this.expression(); this.consume(']');
        this.vm.writeArithmetic('add');
        this.vm.writePop('pointer', 1);
        this.vm.writePush('that', 0);
      }
      return;
    }
    this.fail(`termo inválido: ${token.value}`);
  }
  subroutineCall() {
    const first = this.consume('identifier').value;
    let functionName;
    let implicitArgs = 0;
    if (this.match('.')) {
      this.consume('.');
      const method = this.consume('identifier').value;
      const receiver = this.symbols.resolve(first);
      if (receiver) {
        this.pushVar(first);
        implicitArgs = 1;
        functionName = `${receiver.type}.${method}`;
      } else functionName = `${first}.${method}`;
    } else {
      const kind = this.classSubroutineKinds.get(first);
      if (!kind) this.fail(`sub-rotina não declarada: ${first}`);
      if (kind === 'method') {
        if (this.currentSubroutineKind === 'function') this.fail(`método ${first} exige um objeto receptor`);
        this.vm.writePush('pointer', 0);
        implicitArgs = 1;
      }
      functionName = `${this.className}.${first}`;
    }
    this.consume('(');
    const args = this.expressionList();
    this.consume(')');
    this.vm.writeCall(functionName, args + implicitArgs);
  }
  expressionList() {
    if (this.match(')')) return 0;
    let count = 1;
    this.expression();
    while (this.match(',')) {
      this.consume(',');
      this.expression();
      count++;
    }
    return count;
  }
}
module.exports = CompilationEngine;
