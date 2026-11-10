const Parser = require('../parser/Parser');
const SymbolTable = require('./SymbolTable');
const VMWriter = require('./VMWriter');

// Commit 02: condicionais, laços e chamadas de funções (sem objetos).
// Herda navegação e validação de tokens do Parser do Projeto 10.
// Sobrescreve os métodos gramaticais para produzir VM, não XML.
class CompilationEngine extends Parser {
  constructor(tokens, writer = new VMWriter()) {
    super(tokens);
    this.vm = writer;
    this.symbols = new SymbolTable();
    this.className = '';
    this.subroutineName = '';
    this.labelIndex = 0;
    this.classSubroutineKinds = new Map();
  }
  // O Parser XML escreve em XmlWriter; aqui não emitimos XML.
  consume(expected) {
    const token = this.peek();
    if (!token) this.fail(\`esperado \${expected}\`);
    if (!this._isValid(token, expected)) this.fail(\`esperado \${expected}, encontrado \${token.value}\`);
    return this.advance();
  }
  type() {
    if (this.match('int', 'char', 'boolean') || this.matchType('identifier')) return this.advance().value;
    this.fail('tipo esperado');
  }
  parse() {
    this.class();
    if (this.peek()) this.fail(\`token extra: \${this.peek().value}\`);
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
        if (nameToken?.type === 'identifier') this.classSubroutineKinds.set(nameToken.value, token.value);
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
    if (kind !== 'function') this.fail('métodos e construtores serão implementados no commit 03');
    this.symbols.startSubroutine();
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
    this.vm.writeFunction(\`\${this.className}.\${this.subroutineName}\`, this.symbols.varCount('var'));
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
    if (!entry) this.fail(\`variável não declarada: \${name}\`);
    return entry;
  }
  pushVar(name) { const s = this.symbol(name); this.vm.writePush(this.segment(s), s.index); }
  popVar(name) { const s = this.symbol(name); this.vm.writePop(this.segment(s), s.index); }
  label(prefix) { return \`\${this.className}.\${this.subroutineName}$\${prefix}\${this.labelIndex++}\`; }
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
    if (this.match('[')) this.fail('arrays serão implementados no commit 03');
    this.consume('=');
    this.expression();
    this.consume(';');
    this.popVar(name);
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
    if (!this.match(';')) this.expression();
    else this.vm.writePush('constant', 0); // retorno void também retorna um valor VM
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
      if (!Number.isInteger(value) || value < 0 || value > 32767) this.fail(\`constante fora do intervalo: \${value}\`);
      this.vm.writePush('constant', value);
      return;
    }
    if (['stringConstant','string'].includes(token.type)) this.fail('strings serão implementadas no commit 03');
    if (this.match('this')) this.fail('objetos serão implementados no commit 03');
    if (this.match('true','false','null')) {
      const value = this.advance().value;
      if (value === 'true') {
        this.vm.writePush('constant', 0);
        this.vm.writeArithmetic('not');
      } else this.vm.writePush('constant', 0);
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
      if (this.match('[')) this.fail('arrays serão implementados no commit 03');
      this.pushVar(name);
      return;
    }
    this.fail(\`termo inválido: \${token.value}\`);
  }
  subroutineCall() {
    const first = this.consume('identifier').value;
    let functionName;
    if (this.match('.')) {
      this.consume('.');
      const second = this.consume('identifier').value;
      if (this.symbols.resolve(first)) this.fail('chamadas de métodos em objetos serão implementadas no commit 03');
      functionName = \`\${first}.\${second}\`;
    } else {
      const kind = this.classSubroutineKinds.get(first);
      if (kind !== 'function') this.fail(\`chamada interna não suportada: \${first} (métodos no commit 03)\`);
      functionName = \`\${this.className}.\${first}\`;
    }
    this.consume('(');
    const count = this.expressionList();
    this.consume(')');
    this.vm.writeCall(functionName, count);
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