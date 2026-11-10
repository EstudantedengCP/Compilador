class SymbolTable {
  constructor() { this.startClass(); }
  startClass() {
    this.classSymbols = new Map();
    this.classCounts = { static: 0, field: 0 };
    this.startSubroutine();
  }
  startSubroutine() {
    this.subroutineSymbols = new Map();
    this.subCounts = { argument: 0, var: 0 };
  }
  define(name, type, kind) {
    const isClass = kind === 'static' || kind === 'field';
    const scope = isClass ? this.classSymbols : this.subroutineSymbols;
    const counts = isClass ? this.classCounts : this.subCounts;
    if (!Object.hasOwn(counts, kind)) throw new Error(`Categoria inválida: ${kind}`);
    if (scope.has(name)) throw new SyntaxError(`Identificador duplicado: ${name}`);
    const entry = { name, type, kind, index: counts[kind]++ };
    scope.set(name, entry);
    return entry;
  }
  varCount(kind) {
    return (kind === 'static' || kind === 'field' ? this.classCounts : this.subCounts)[kind] ?? 0;
  }
  resolve(name) {
    return this.subroutineSymbols.get(name) || this.classSymbols.get(name) || null;
  }
}
module.exports = SymbolTable;
