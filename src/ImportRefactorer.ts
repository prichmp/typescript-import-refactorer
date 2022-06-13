import chalk from 'chalk';
import fs from 'fs';
import { glob } from 'glob';
import path, { basename } from "path";
import { SourceFile, SyntaxKind } from 'ts-morph';
import Logger from './Logger';

export default class ImportRefactorer
{
    public static async rewriteImports(sourceFile: SourceFile, filepath: string, possibleImports: string[]): Promise<SourceFile>
    {
        Logger.log(chalk.blue(`${filepath}`));

        const nodeNames: Set<string> = new Set();
        const importDeclarations = sourceFile.getChildrenOfKind(SyntaxKind.ImportDeclaration);

        for (const importDeclaration of importDeclarations)
        {
            const importClause = importDeclaration.asKind(SyntaxKind.ImportDeclaration)?.getImportClause();
            const moduleSpecifier = importDeclaration.asKind(SyntaxKind.ImportDeclaration)?.getModuleSpecifier();

            Logger.debug(`import ${importClause!.getFullText()} from ${moduleSpecifier!.getFullText()}`);

            if (!importClause)
            {
                Logger.debug(`importClause is undefined`);
                continue;
            }

            if (!moduleSpecifier)
            {
                Logger.debug(`moduleSpecifier is undefined`);
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
                        found = true;
                        break;
                    }
                }

                if (!found)
                {
                    const updatedPath = ImportRefactorer.lookForMatchingFile(filepath, cleanedModuleSpecifier, possibleImports);

                    if (!updatedPath)
                    {
                        Logger.log(chalk.red(`    "${cleanedModuleSpecifier}" No match found`));
                    }
                    else
                    {
                        const correctedSlashesPath = updatedPath.replace(/[\\]/g, "/");
                        const removedTypeScriptExtensionPath = correctedSlashesPath.replace(/\.tsx?$/, "");
                        Logger.debug(chalk.green(`    "${cleanedModuleSpecifier}" -> "${removedTypeScriptExtensionPath}"`));
                        moduleSpecifier.replaceWithText(` '${removedTypeScriptExtensionPath}'`);
                    }
                }
            }
        }

        return sourceFile;
    }

    /**
     * 
     * @param filepath The path of the source file containing the import statement.
     * @param source The last part of the import statement that describes where to look for the file to import.
     * @param possibleImports The list of all possible imports as given with a glob on the command line.
     * @returns Null if a import was not found, the resolved filepath otherwise. 
     */
    private static lookForMatchingFile(filepath: string, source: string, possibleImports: string[]): string | null
    {
        const cleanedSource = ImportRefactorer.cleanSource(source);

        const matchingImports: string[] = [];
        if (ImportRefactorer.hasFileExtension(source))
        {
            const basename = path.basename(cleanedSource);

            for (const possibleImport of possibleImports)
            {
                if (path.basename(possibleImport) === basename)
                {
                    matchingImports.push(possibleImport);
                }
            }
        }
        else
        {
            const matches = /[\/\\]([a-zA-Z0-9_-]+)$/.exec(cleanedSource);
            if (!matches)
            {
                throw new Error(`source ${cleanedSource} from file ${filepath} did not match basename extraction regex.`);
            }

            const basename = matches[1];

            for (const possibleImport of possibleImports)
            {
                const trimmedPossibleImport = ImportRefactorer.trimFileExtension(path.basename(possibleImport));
                if (trimmedPossibleImport === basename)
                {
                    matchingImports.push(possibleImport);
                }
                else if (["index.ts", "index.tsx"].includes(path.basename(possibleImport)))
                {
                    if (path.basename(path.dirname(possibleImport)) === basename)
                    {
                        matchingImports.push(possibleImport);
                    }
                }
            }
        }

        let result = '';
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
            // We want to return the matching import closest on the filesystem to the source file.
            matchingImports.sort((a, b) =>
            {
                const aRel = ImportRefactorer.countPathSegments(path.relative(path.join(filepath, ".."), a));
                const bRel = ImportRefactorer.countPathSegments(path.relative(path.join(filepath, ".."), b));

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
            });

            result = path.relative(path.join(filepath, ".."), matchingImports[0]);
        }

        // Typescript needs the extra "./" as opposed to the command line. 
        if (!result.startsWith('.'))
        {
            result = `./${result}`;
        }

        return result;

    }

    private static countPathSegments(filepath:string): number
    {
        return (filepath.match(/[\/\\]/g) || []).length;
    }

    /**
     * Removes everything after the first dot in the filename
     * @param filepath The filename to remove the extension from
     * @returns "Myfile.ext" => "myfile"
     */
    private static trimFileExtension(filepath: string)
    {
        return filepath.replace(/\.[^\.]+$/, "");
    }

    /**
     * Removes any extra charactrs so that we are just left with the relative path. 
     * @param source from importDef.source - the import location
     * @returns A cleaner import location
     */
    private static cleanSource(source: string): string
    {
        // Remove any Webpack URL things 
        return source.replace(/\?.*$/, "");
    }

    /**
     * Uses the glob library to search for files.
     * @param pattern The gob pattern describing the files to search for.
     * @returns A list of all absolute filepaths matching the pattern.
     */
    public static async asyncGlob(pattern: string): Promise<string[]>
    {
        return new Promise<string[]>((res, rej) => glob(pattern, { absolute: true }, (error, matches) =>
        {
            if (error)
            {
                rej(error);
                return;
            }

            res(matches);
        }));
    }

    /**
     * Simply looks for the filepath starting with a "./" or a "../".
     * @param source The filepath from the import statement.
     * @returns True if it starts with a dot.
     */
    private static isRelativeImport(source: string): boolean
    {
        return source.startsWith('.');
    }

    /**
     * Tries to replicate Typescript's import resolution search pattern.
     * @param fileLocation The source file's filepath.
     * @param source The relative filepath from the last part of the import statement.
     * @returns A list of file paths
     */
    private static listPossiblePaths(fileLocation: string, source: string)
    {
        const pathOne = path.join(path.join(fileLocation, ".."), source);

        if (ImportRefactorer.hasFileExtension(fileLocation))
        {
            return [pathOne];
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

        const results = [];
        for (const fileExtension of fileExtensions)
        {
            results.push(pathOne + fileExtension);
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
            results.push(path.join(pathOne, indexFilename));
        }

        return results;
    }

    /**
     * Checks to see if the filepath has a file extension, or if a filepath will need to be added.
     * @param filepath The filepath to check
     * @returns True if the filename has a "something.ext" format.
     */
    private static hasFileExtension(filepath: string)
    {
        return /(\.[A-Z0-9])?\.[A-Z0-9]$/i.test(filepath);
    }

    /**
     * Returns true if the file exists and is a file.
     * @param filepath The file to check
     */
    private static async isFile(filepath: string): Promise<boolean>
    {
        try
        {
            const stat = await fs.promises.lstat(filepath);
            return stat.isFile();
        }
        catch (ex)
        {
            return false;
        }
    }
}

