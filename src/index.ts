import chalk from 'chalk';
import fs from 'fs';
import yargs from 'yargs';
import ImportRefactorer from './ImportRefactorer';
import { Project, ScriptTarget } from "ts-morph";

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
    .option('ts-config', {
        alias: 't',
        demandOption: true
    })
    .option('dry-run', {
        alias: 'd',
        boolean: true,
        default: false
    })
    .argv;


(async () =>
{
    const fulfilledOptions = await options;

    const sourceCodeFilepaths = await ImportRefactorer.asyncGlob(fulfilledOptions.source as string);
    const possibleImports = await ImportRefactorer.asyncGlob(fulfilledOptions.imports as string);

    const project = new Project({
        tsConfigFilePath: fulfilledOptions['ts-config'] as string,
        //skipAddingFilesFromTsConfig: true,
    });

    console.log(`Found ${sourceCodeFilepaths.length} source code files`);
    console.log(`Found ${possibleImports.length} possible imports`);

    const sourceFiles = project.getSourceFiles();
    console.log(sourceFiles.length)

    for (const sourceCodeFilepath of sourceCodeFilepaths)
    {
        const fileContents = await readFile(sourceCodeFilepath)
        const sourceCode = project.createSourceFile(sourceCodeFilepath, fileContents, {overwrite: true});
        //const sourceCode = project.getSourceFile(sourceCodeFilepath);

        if (!sourceCode)
        {
            console.log(chalk.red(`Could not find file "${sourceCodeFilepath}"`));
            continue;
        }

        try 
        {
            const newCode = await ImportRefactorer.rewriteImports(sourceCode, sourceCodeFilepath, possibleImports);

            if (!fulfilledOptions['dry-run'])
            {
                await newCode.save()
                console.log(`Wrote out new code to ${sourceCodeFilepath}`);
            }
        }
        catch (ex)
        {
            console.log(chalk.red(`Could not process file "${sourceCodeFilepath}"`))
            console.log(ex)
        }
    }

    async function readFile(filepath: string): Promise<string> 
    {
        console.log(`Opening file "${filepath}"`)
        const data = await fs.promises.readFile(filepath, 'utf8');
        return data;
    }

    async function writeFile(filepath: string, contents: string): Promise<void> 
    {
        await fs.promises.writeFile(filepath, contents, 'utf8');
    }

})()





