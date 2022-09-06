export const reservedVariableNames = [ '_context', '_buffer', '_offset', '_end', '_constants', '_noop', '_reset', '_go' ];

export function isValidVariableName(name: string): boolean {
  return (
    /^([a-z_$][a-z\d_$]*)$/i.test(name) && // Valid JS names
    !/^_step\d*$/.test(name) && // Reserved names for step functions
    !/^\$_/.test(name) && // Reserved names for prefixed code
    !/^(_finish|_emit)/.test(name) && // Overlaps of built items
    !reservedVariableNames.includes(name) && // Reserved variables
    !/^(if|else|class|constructor|private|public|protected|function|for|while|const|let|var|get|static|return)$/.test(name) // Possible syntax errors
  );
}
