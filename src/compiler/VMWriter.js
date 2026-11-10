class VMWriter {
  constructor() { this.lines = []; }
  writePush(segment, index) { this.lines.push(`push ${segment} ${index}`); }
  writePop(segment, index) { this.lines.push(`pop ${segment} ${index}`); }
  writeArithmetic(command) { this.lines.push(command); }
  writeLabel(label) { this.lines.push(`label ${label}`); }
  writeGoto(label) { this.lines.push(`goto ${label}`); }
  writeIf(label) { this.lines.push(`if-goto ${label}`); }
  writeCall(name, count) { this.lines.push(`call ${name} ${count}`); }
  writeFunction(name, locals) { this.lines.push(`function ${name} ${locals}`); }
  writeReturn() { this.lines.push('return'); }
  toString() { return this.lines.join('\n') + (this.lines.length ? '\n' : ''); }
}
module.exports = VMWriter;
