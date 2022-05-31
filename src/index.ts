import fs from 'fs';
import yargs from 'yargs';
import ImportRefactorer from './ImportRefactorer';

/**
 * "source": is a glob that should match the files that have bad imports
 * "imports": Is a glob containing the entire possilbe import files
 */
const options = yargs
    .option('source', {
        alias: 's',
        demandOption: true
    })
    .option('imports', {
        alias: 'i',
        demandOption: true
    })
    .option('dry-run', {
        alias: 'd',
        boolean: true,
        default: false
    })
    .argv;


const fufilledOptions = await options;

const sourceCodeFilepaths = await ImportRefactorer.asyncGlob(fufilledOptions.source as string);
const possibleImports = await ImportRefactorer.asyncGlob(fufilledOptions.imports as string);

console.log(`Found ${sourceCodeFilepaths.length} source code files`);
console.log(`Found ${possibleImports.length} possible imports`);

for(const sourceCodeFilepath in sourceCodeFilepaths)
{
    const sourceCode = await readFile(sourceCodeFilepath);
    const newcode = ImportRefactorer.rewriteImports(sourceCode, sourceCodeFilepath, possibleImports);

    if(!fufilledOptions['dry-run'] && newcode !== sourceCode)
    {
        await writeFile(sourceCodeFilepath, newcode);
        console.log(`Wrote out new code to ${sourceCodeFilepath}`);
    }
}

async function readFile(filepath: string): Promise<string> 
{
    const data = await fs.promises.readFile(filepath, 'utf8');
    return data;
}

async function writeFile(filepath: string, contents: string): Promise<void> 
{
    await fs.promises.writeFile(filepath, contents, 'utf8');
}




