import { OneCLI } from '../src/cli/oneCLI';
const cli = new OneCLI();
cli.executeCommand(['node', 'one', 'compile', 'spatial', '--emit-binary']);
