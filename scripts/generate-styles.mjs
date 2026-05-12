import { readFileSync, writeFileSync } from 'node:fs';
const css = readFileSync('src/styles.css', 'utf8').replaceAll('`', '\\`').replaceAll('${', '\\${');
writeFileSync('src/styles.generated.ts', `export const styles = \`${css}\`;\n`);
