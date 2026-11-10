const Parser = require('../parser/Parser');
const SymbolTable = require('./SymbolTable');
const VMWriter = require('./VMWriter');

// Etapa 1: geração básica de VM para funções, variáveis e expressões.
// Controle de fluxo, chamadas, objetos, arrays e strings entram nas próximas etapas.
class CompilationEngine extends Parser {
  constructor(tokens, writer = new VMWriter()) {
    super(tokens);
    this.vm = writer;
    this.symbols = new SymbolTable();
    this.className = '';
    this.subroutineName = '';
  }

  consume(expected) {
    const token = this.peek();
    if (!token || !this._isValid(token, expected)) {
      this.fail(`esperado ${expected}, encontrado ${token?.value ?? 'fim do arquivo'}`);
    }
    return this.advance();
  }

  parse() {
    this.class();
    if (this.peek()) this.fail(`token inesperado: ${this.peek().value}`);
    return this.vm.toString();
  }

  type() {
    if (this.match('int', 'char', 'boolean') || this.matchType('identifier')) {
      return this.advance().value;
    }
    this.fail('tipo esperado');
  }

  class() {
    this.consume('class');
    this.className = this.consume('identifier').value;
    this.consume('{');
    this.symbols.startClass();
    while (this.match('static', 'field')) this.classVarDec();
    while (this.match('constructor', 'function', 'method')) this.subroutineDec();
    this.consume('}');
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
    if (kind !== 'function') this.fail('métodos e construtores serão implementados na etapa 3');
    this.symbols.startSubroutine();
    if (this.match('void')) this.advance();
    else this.type();
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

  variable(name) {
    const symbol = this.symbols.resolve(name);
    if (!symbol) this.fail(`variável não declarada: ${name}`);
    const segment = { static: 'static', field: 'this', argument: 'argument', var: 'local' }[symbol.kind];
    return { segment, index: symbol.index };
  }

  statements() {
    while (this.match('let', 'if', 'while', 'do', 'return')) {
      if (this.match('let')) this.letStatement();
      else if (this.match('return')) this.returnStatement();
      else this.fail('if, while e do serão implementados nas próximas etapas');
    }
  }

  letStatement() {
    this.consume('let');
    const name = this.consume('identifier').value;
    if (this.match('[')) this.fail('arrays serão implementados na etapa 3');
    this.consume('=');
    this.expression();
    this.consume(';');
    const dest = this.variable(name);
    this.vm.writePop(dest.segment, dest.index);
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
      const arithmetic = { '+': 'add', '-': 'sub', '&': 'and', '|': 'or',
                           '<': 'lt', '>': 'gt', '=': 'eq' };
      if (op === '*') this.vm.writeCall('Math.multiply', 2);
      else if (op === '/') this.vm.writeCall('Math.divide', 2);
      else this.vm.writeArithmetic(arithmetic[op]);
    }
  }

  term() {
    const token = this.peek();
    if (!token) this.fail('termo esperado');
    if (['integerConstant', 'integer', 'int'].includes(token.type)) {
      this.vm.writePush('constant', Number(this.advance().value));
    } else if (this.match('true', 'false', 'null')) {
      const value = this.advance().value;
      this.vm.writePush('constant', 0);
      if (value === 'true') this.vm.writeArithmetic('not');
    } else if (this.match('(')) {
      this.consume('('); this.expression(); this.consume(')');
    } else if (this.match('-', '~')) {
      const op = this.advance().value;
      this.term();
      this.vm.writeArithmetic(op === '-' ? 'neg' : 'not');
    } else if (this.matchType('identifier')) {
      const name = this.advance().value;
      if (this.match('(', '.', '[')) this.fail('chamadas e arrays serão implementados nas próximas etapas');
      const source = this.variable(name);
      this.vm.writePush(source.segment, source.index);
    } else if (['stringConstant', 'string'].includes(token.type) || this.match('this')) {
      this.fail('strings e objetos serão implementados na etapa 3');
    } else this.fail(`termo inválido: ${token.value}`);
  }
}

module.exports = CompilationEngine;
