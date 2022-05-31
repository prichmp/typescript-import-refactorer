import chalk from 'chalk';
import fs from 'fs'
import { glob } from 'glob';
import path, { basename } from "path";
import transformImports from "transform-imports";

export default class ImportRefactorer
{
    public static rewriteImports(code: string, filepath: string, possibleimports: string[]): string
    {
        console.log(chalk.blue(`${filepath}`))
        const newCode = transformImports(code, (importDefs) =>
        {
            importDefs.forEach((importDef) =>
            {

                if (ImportRefactorer.isRelativeImport(importDef.source))
                {
                    const possiblePaths = ImportRefactorer.listPossiblePaths(filepath, importDef.source);
                    let found = false;
                    for (const path of possiblePaths)
                    {
                        if (ImportRefactorer.isFile(path))
                        {
                            found = true
                            break
                        }
                    }

                    if (!found)
                    {
                        const updatedPath = ImportRefactorer.lookForMatchingFile(filepath, importDef.source, possibleimports);
                        if (!updatedPath)
                        {
                            console.log(chalk.red(`    "${importDef.source}" No match found`))
                        }
                        else
                        {
                            console.log(chalk.green(`    "${importDef.source}" -> "${updatedPath}"`))
                            importDef.source = updatedPath;
                        }
                    }

                }
            });
        });

        return newCode;
    }

    private static lookForMatchingFile(filepath: string, source: string, possibleimports: string[]): string | null
    {
        const cleanedSource = ImportRefactorer.cleanSource(source)

        const matchingImports: string[] = [];
        if (ImportRefactorer.hasFileExtension(source))
        {
            const basename = path.basename(cleanedSource)

            for (const possibleImport of possibleimports)
            {
                if (path.basename(possibleImport) === basename)
                {
                    matchingImports.push(possibleImport)
                }
            }
        }
        else
        {
            const matches = /[\/\\]([a-zA-Z0-9_-])$/.exec(cleanedSource)
            if (!matches)
            {
                throw new Error(`source ${cleanedSource} from file ${filepath} did not match basename extraction regex.`)
            }

            const basename = matches[1];

            for (const possibleImport of possibleimports)
            {
                if (ImportRefactorer.trimFileExtension(path.basename(possibleImport)) === basename)
                {
                    matchingImports.push(possibleImport)
                }
            }
        }

        if (matchingImports.length === 0)
        {
            return null;
        }
        else if (matchingImports.length === 1)
        {
            return matchingImports[0];
        }
        else
        {
            matchingImports.sort((a, b) =>
            {
                const aRel = path.relative(filepath, a);
                const bRel = path.relative(filepath, b);

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

            return matchingImports[0]
        }

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
        return new Promise<string[]>((res, rej) => glob(pattern, (error, matches) =>
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
        const pathOne = path.join(fileLocation, source)

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

