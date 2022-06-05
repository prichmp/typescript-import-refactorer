import chalk from 'chalk';
import fs from 'fs'
import { glob } from 'glob';
import path, { basename } from "path";
import { SourceFile, SyntaxKind } from 'ts-morph';

export default class ImportRefactorer
{
    public static async rewriteImports(sourceFile: SourceFile, filepath: string, possibleImports: string[]): Promise<SourceFile>
    {
        console.log(chalk.blue(`${filepath}`))        

        const nodeNames: Set<string> = new Set();
        const importDeclarations = sourceFile.getChildrenOfKind(SyntaxKind.ImportDeclaration)

        for(const importDeclaration of importDeclarations)
        {
            const importClause = importDeclaration.asKind(SyntaxKind.ImportDeclaration)?.getImportClause();
            const moduleSpecifier = importDeclaration.asKind(SyntaxKind.ImportDeclaration)?.getModuleSpecifier();

            console.log(`import ${importClause!.getFullText()} from ${moduleSpecifier!.getFullText()}`);
            if(!importClause)
            {
                console.log(`importClause is undefined`);
                continue
            }

            if(!moduleSpecifier)
            {
                console.log(`moduleSpecifier is undefined`);
                continue;
            }

            const cleanedModuleSpecifier = moduleSpecifier.getFullText().trim().replace(/["']/g, "");
            if (ImportRefactorer.isRelativeImport(cleanedModuleSpecifier))
            {
                const possiblePaths = ImportRefactorer.listPossiblePaths(filepath, cleanedModuleSpecifier);
                let found = false;
                for (const path of possiblePaths)
                {
                    if (await ImportRefactorer.isFile(path))
                    {
                        found = true
                        break
                    }
                }

                if (!found)
                {
                    const updatedPath = ImportRefactorer.lookForMatchingFile(filepath, cleanedModuleSpecifier, possibleImports);

                    if (!updatedPath)
                    {
                        console.log(chalk.red(`    "${cleanedModuleSpecifier}" No match found`))
                    }
                    else
                    {
                        const correctedSlashesPath = updatedPath.replace(/[\\]/g, "/")
                        const removedTypeScriptExtensionPath = correctedSlashesPath.replace(/\.tsx?$/, "")
                        console.log(chalk.green(`    "${cleanedModuleSpecifier}" -> "${removedTypeScriptExtensionPath}"`))
                        moduleSpecifier.replaceWithText(` '${removedTypeScriptExtensionPath}'`);
                    }
                }
            }
        }

        return sourceFile;
    }

    private static lookForMatchingFile(filepath: string, source: string, possibleImports: string[]): string | null
    {
        const cleanedSource = ImportRefactorer.cleanSource(source)

        const matchingImports: string[] = [];
        if (ImportRefactorer.hasFileExtension(source))
        {
            const basename = path.basename(cleanedSource)

            for (const possibleImport of possibleImports)
            {
                if (path.basename(possibleImport) === basename)
                {
                    matchingImports.push(possibleImport)
                }
            }
        }
        else
        {
            const matches = /[\/\\]([a-zA-Z0-9_-]+)$/.exec(cleanedSource)
            if (!matches)
            {
                throw new Error(`source ${cleanedSource} from file ${filepath} did not match basename extraction regex.`)
            }

            const basename = matches[1];

            for (const possibleImport of possibleImports)
            {
                const trimmedPossibleImport = ImportRefactorer.trimFileExtension(path.basename(possibleImport))
                if (trimmedPossibleImport === basename)
                {
                    matchingImports.push(possibleImport)
                }
                else if(["index.ts", "index.tsx"].includes(path.basename(possibleImport)))
                {
                    if(path.basename(path.dirname(possibleImport)) === basename)
                    {
                        matchingImports.push(possibleImport);
                    }
                }
            }
        }

        let result = ''
        if (matchingImports.length === 0)
        {
            return null;
        }
        else if (matchingImports.length === 1)
        {
            result = path.relative(path.join(filepath, ".."), matchingImports[0]);

        }
        else
        {
            matchingImports.sort((a, b) =>
            {
                const aRel = path.relative(path.join(filepath, ".."), a);
                const bRel = path.relative(path.join(filepath, ".."), b);

                if (aRel > bRel)
                {
                    return 1;
                }
                else if (aRel < bRel)
                {
                    return -1;
                }
                else
                {
                    return 0;
                }
            })

            result = path.relative(path.join(filepath, ".."), matchingImports[0])
        }

        if(!result.startsWith('.'))
        {
            result = `./${result}`;
        }

        return result

    }

    private static trimFileExtension(filepath: string)
    {
        return filepath.replace(/\.[^\.]+$/, "")
    }

    /**
     * Removes any extra charactrs so that we are just left with the relative path. 
     * @param source from importDef.source - the import location
     * @returns A cleaner import location
     */
    private static cleanSource(source: string): string
    {
        // Remove any Webpack URL things 
        return source.replace(/\?.*$/, "")
    }

    public static async asyncGlob(pattern: string): Promise<string[]>
    {
        return new Promise<string[]>((res, rej) => glob(pattern, {absolute: true}, (error, matches) =>
        {
            if (error)
            {
                rej(error)
                return
            }

            res(matches)
        }))
    }

    // Logs:
    // import Foo from "foo";
    // import Foo from "something-new";

    private static isRelativeImport(source: string)
    {
        return source.startsWith('.');
    }

    private static listPossiblePaths(fileLocation: string, source: string)
    {
        const pathOne = path.join(path.join(fileLocation, ".."), source)

        if (ImportRefactorer.hasFileExtension(fileLocation))
        {
            return [pathOne]
        }

        const fileExtensions = [
            '.ts',
            '.tsx',
            '.d.ts',
            '.js',
            '.jsx',
            '.mjs',
            '.json',
            '.vue',
            '.svelte'
        ];

        const results = []
        for (const fileExtension of fileExtensions)
        {
            results.push(pathOne + fileExtension)
        }

        const indexFilenames = [
            'index.ts',
            'index.tsx',
            'index.d.ts',
            'index.js',
            'index.jsx'
        ];

        for (const indexFilename of indexFilenames)
        {
            results.push(path.join(pathOne, indexFilename))
        }

        return results;
    }

    private static hasFileExtension(filepath: string)
    {
        return /(\.[A-Z0-9])?\.[A-Z0-9]$/i.test(filepath)
    }

    private static async isDirectory(filepath: string): Promise<boolean>
    {
        try
        {
            const stat = await fs.promises.lstat(filepath);
            return stat.isDirectory();
        }
        catch (ex)
        {
            return false
        }
    }

    private static async isFile(filepath: string): Promise<boolean>
    {
        try
        {
            const stat = await fs.promises.lstat(filepath);
            return stat.isFile();
        }
        catch (ex)
        {
            return false
        }
    }
}

