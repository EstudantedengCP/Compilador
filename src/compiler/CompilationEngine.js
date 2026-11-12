const Parser = require('../parser/Parser');
const SymbolTable = require('./SymbolTable');
const VMWriter = require('./VMWriter');

// Commit 03: métodos, construtores, arrays e strings.
// Herda navegação e validação de tokens do Parser do Projeto 10.
// Sobrescreve os métodos gramaticais para produzir VM, não XML.
class CompilationEngine extends Parser {
  constructor(tokens, writer = new VMWriter()) {
    super(tokens);
    this.vm = writer;
    this.symbols = new SymbolTable();
    this.className = '';
    this.subroutineName = '';
    this.currentSubroutineKind = '';
    this.currentReturnType = '';
    this.labelIndex = 0;
    this.classSubroutineKinds = new Map();
  }
  // O Parser XML escreve em XmlWriter; aqui não emitimos XML.
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
    while (this.match('static', 'field')) this.classVarDec();
    // Permite identificar chamadas internas a métodos declarados mais abaixo.
    this.scanSubroutineKinds();
    while (this.match('constructor', 'function', 'method')) this.subroutineDec();
    this.consume('}');
  }
  scanSubroutineKinds() {
    let depth = 0;
    for (let i = this.pos; i < this.tokens.length; i++) {
      const token = this.tokens[i];
      if (token.value === '{') depth++;
      if (token.value === '}') { if (depth === 0) break; depth--; }
      if (depth === 0 && ['constructor', 'function', 'method'].includes(token.value)) {
        const nameToken = this.tokens[i + 2];
        if (nameToken?.type === 'identifier') {
          // Nomes de sub-rotina são únicos na classe, qualquer que seja o tipo.
          if (this.classSubroutineKinds.has(nameToken.value)) {
            throw new SyntaxError(`Erro sintático (linha ${nameToken.line}, coluna ${nameToken.column}): sub-rotina duplicada: ${nameToken.value}`);
          }
          this.classSubroutineKinds.set(nameToken.value, token.value);
        }
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
    if (kind === 'constructor' && !this.match(this.className)) {
      const found = this.peek() ? this.peek().value : 'fim do arquivo';
      this.fail(`construtor deve retornar o tipo da classe ${this.className}, encontrado ${found}`);
    }
    // Guardado para validar os comandos return desta sub-rotina.
    this.currentReturnType = this.match('void') ? this.advance().value : this.type();
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
    return ({ static: 'static', field: 'this', argument: 'argument', var: 'local' })[symbol.kind];
  }
  symbol(name) {
    const entry = this.symbols.resolve(name);
    if (!entry) this.fail(`variável não declarada: ${name}`);
    return entry;
  }
  pushVar(name) {
    const s = this.symbol(name);
    if (s.kind === 'field' && this.currentSubroutineKind === 'function') {
      this.fail(`função não pode acessar o campo de instância: ${name}`);
    }
    this.vm.writePush(this.segment(s), s.index);
  }
  popVar(name) {
    const s = this.symbol(name);
    if (s.kind === 'field' && this.currentSubroutineKind === 'function') {
      this.fail(`função não pode modificar o campo de instância: ${name}`);
    }
    this.vm.writePop(this.segment(s), s.index);
  }
  label(prefix) { return `${this.className}.${this.subroutineName}$${prefix}${this.labelIndex++}`; }
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
      this.consume('['); this.expression(); this.consume(']');
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
    const labelTrue = this.label('IF_TRUE');
    const labelFalse = this.label('IF_FALSE');
    const labelEnd = this.label('IF_END');
    this.vm.writeIf(labelTrue);
    this.vm.writeGoto(labelFalse);
    this.vm.writeLabel(labelTrue);
    this.consume('{'); this.statements(); this.consume('}');
    if (this.match('else')) {
      this.vm.writeGoto(labelEnd);
      this.vm.writeLabel(labelFalse);
      this.consume('else'); this.consume('{'); this.statements(); this.consume('}');
      this.vm.writeLabel(labelEnd);
    } else this.vm.writeLabel(labelFalse);
  }
  whileStatement() {
    const labelStart = this.label('WHILE_EXP');
    const labelEnd = this.label('WHILE_END');
    this.vm.writeLabel(labelStart);
    this.consume('while'); this.consume('('); this.expression(); this.consume(')');
    this.vm.writeArithmetic('not');
    this.vm.writeIf(labelEnd);
    this.consume('{'); this.statements(); this.consume('}');
    this.vm.writeGoto(labelStart);
    this.vm.writeLabel(labelEnd);
  }
  doStatement() {
    this.consume('do');
    this.subroutineCall();
    this.consume(';');
    this.vm.writePop('temp', 0); // descarta retorno da função
  }
  returnStatement() {
    this.consume('return');
    const isVoid = this.currentReturnType === 'void';
    if (this.match(';')) {
      if (!isVoid) this.fail(`sub-rotina ${this.subroutineName} deve retornar um valor do tipo ${this.currentReturnType}`);
      this.vm.writePush('constant', 0); // retorno void também retorna um valor VM
    } else if (isVoid) {
      // "return }" continua sendo erro de ";" ausente; só rejeita valor de fato.
      if (this.peek() && this.peek().value !== '}') this.fail(`sub-rotina void ${this.subroutineName} não pode retornar um valor`);
    } else this.expression();
    this.consume(';');
    this.vm.writeReturn();
  }
  expression() {
    this.term();
    while (this.match('+', '-', '*', '/', '&', '|', '<', '>', '=')) {
      const op = this.advance().value;
      this.term();
      const operations = { '+':'add', '-':'sub', '&':'and', '|':'or', '<':'lt', '>':'gt', '=':'eq' };
      if (op === '*') this.vm.writeCall('Math.multiply', 2);
      else if (op === '/') this.vm.writeCall('Math.divide', 2);
      else this.vm.writeArithmetic(operations[op]);
    }
  }
  term() {
    const token = this.peek();
    if (!token) this.fail('termo esperado');
    if (['integerConstant','integer','int'].includes(token.type)) {
      const value = Number(this.advance().value);
      if (!Number.isInteger(value) || value < 0 || value > 32767) this.fail(`constante fora do intervalo: ${value}`);
      this.vm.writePush('constant', value);
      return;
    }
    if (['stringConstant','string'].includes(token.type)) {
      const value = String(this.advance().value);
      this.vm.writePush('constant', value.length);
      this.vm.writeCall('String.new', 1);
      for (const char of value) {
        if (char.charCodeAt(0) > 32767) this.fail('caractere de string fora do intervalo');
        this.vm.writePush('constant', char.charCodeAt(0));
        this.vm.writeCall('String.appendChar', 2);
      }
      return;
    }
    if (this.match('true','false','null','this')) {
      if (this.match('this') && this.currentSubroutineKind === 'function') {
        this.fail('this não pode ser usado em uma function');
      }
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
        if (receiver.type === this.className) {
          const targetKind = this.classSubroutineKinds.get(method);
          if (!targetKind) this.fail(`sub-rotina não declarada: ${method}`);
          if (targetKind !== 'method') this.fail(`sub-rotina ${method} não é método de instância`);
        }
        this.pushVar(first);
        implicitArgs = 1;
        functionName = `${receiver.type}.${method}`;
      } else {
        if (first === this.className) {
          const targetKind = this.classSubroutineKinds.get(method);
          if (!targetKind) this.fail(`sub-rotina não declarada: ${method}`);
          if (targetKind === 'method') this.fail(`método ${method} exige um objeto receptor`);
        }
        functionName = `${first}.${method}`;
      }
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
      this.consume(','); this.expression(); count++;
    }
    return count;
  }
}
module.exports = CompilationEngine;
