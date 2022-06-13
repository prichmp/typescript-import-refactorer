"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = __importDefault(require("fs"));
const glob_1 = require("glob");
const path_1 = __importDefault(require("path"));
const ts_morph_1 = require("ts-morph");
const Logger_1 = __importDefault(require("./Logger"));
class ImportRefactorer {
    static async rewriteImports(sourceFile, filepath, possibleImports) {
        Logger_1.default.log(chalk_1.default.blue(`${filepath}`));
        const nodeNames = new Set();
        const importDeclarations = sourceFile.getChildrenOfKind(ts_morph_1.SyntaxKind.ImportDeclaration);
        for (const importDeclaration of importDeclarations) {
            const importClause = importDeclaration.asKind(ts_morph_1.SyntaxKind.ImportDeclaration)?.getImportClause();
            const moduleSpecifier = importDeclaration.asKind(ts_morph_1.SyntaxKind.ImportDeclaration)?.getModuleSpecifier();
            Logger_1.default.debug(`import ${importClause.getFullText()} from ${moduleSpecifier.getFullText()}`);
            if (!importClause) {
                Logger_1.default.debug(`importClause is undefined`);
                continue;
            }
            if (!moduleSpecifier) {
                Logger_1.default.debug(`moduleSpecifier is undefined`);
                continue;
            }
            const cleanedModuleSpecifier = moduleSpecifier.getFullText().trim().replace(/["']/g, "");
            if (ImportRefactorer.isRelativeImport(cleanedModuleSpecifier)) {
                const possiblePaths = ImportRefactorer.listPossiblePaths(filepath, cleanedModuleSpecifier);
                let found = false;
                for (const path of possiblePaths) {
                    if (await ImportRefactorer.isFile(path)) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    const updatedPath = ImportRefactorer.lookForMatchingFile(filepath, cleanedModuleSpecifier, possibleImports);
                    if (!updatedPath) {
                        Logger_1.default.log(chalk_1.default.red(`    "${cleanedModuleSpecifier}" No match found`));
                    }
                    else {
                        const correctedSlashesPath = updatedPath.replace(/[\\]/g, "/");
                        const removedTypeScriptExtensionPath = correctedSlashesPath.replace(/\.tsx?$/, "");
                        Logger_1.default.debug(chalk_1.default.green(`    "${cleanedModuleSpecifier}" -> "${removedTypeScriptExtensionPath}"`));
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
    static lookForMatchingFile(filepath, source, possibleImports) {
        const cleanedSource = ImportRefactorer.cleanSource(source);
        const matchingImports = [];
        if (ImportRefactorer.hasFileExtension(source)) {
            const basename = path_1.default.basename(cleanedSource);
            for (const possibleImport of possibleImports) {
                if (path_1.default.basename(possibleImport) === basename) {
                    matchingImports.push(possibleImport);
                }
            }
        }
        else {
            const matches = /[\/\\]([a-zA-Z0-9_-]+)$/.exec(cleanedSource);
            if (!matches) {
                throw new Error(`source ${cleanedSource} from file ${filepath} did not match basename extraction regex.`);
            }
            const basename = matches[1];
            for (const possibleImport of possibleImports) {
                const trimmedPossibleImport = ImportRefactorer.trimFileExtension(path_1.default.basename(possibleImport));
                if (trimmedPossibleImport === basename) {
                    matchingImports.push(possibleImport);
                }
                else if (["index.ts", "index.tsx"].includes(path_1.default.basename(possibleImport))) {
                    if (path_1.default.basename(path_1.default.dirname(possibleImport)) === basename) {
                        matchingImports.push(possibleImport);
                    }
                }
            }
        }
        let result = '';
        if (matchingImports.length === 0) {
            return null;
        }
        else if (matchingImports.length === 1) {
            result = path_1.default.relative(path_1.default.join(filepath, ".."), matchingImports[0]);
        }
        else {
            // We want to return the matching import closest on the filesystem to the source file.
            matchingImports.sort((a, b) => {
                const aRel = ImportRefactorer.countPathSegments(path_1.default.relative(path_1.default.join(filepath, ".."), a));
                const bRel = ImportRefactorer.countPathSegments(path_1.default.relative(path_1.default.join(filepath, ".."), b));
                if (aRel > bRel) {
                    return 1;
                }
                else if (aRel < bRel) {
                    return -1;
                }
                else {
                    return 0;
                }
            });
            result = path_1.default.relative(path_1.default.join(filepath, ".."), matchingImports[0]);
        }
        // Typescript needs the extra "./" as opposed to the command line. 
        if (!result.startsWith('.')) {
            result = `./${result}`;
        }
        return result;
    }
    static countPathSegments(filepath) {
        return (filepath.match(/[\/\\]/g) || []).length;
    }
    /**
     * Removes everything after the first dot in the filename
     * @param filepath The filename to remove the extension from
     * @returns "Myfile.ext" => "myfile"
     */
    static trimFileExtension(filepath) {
        return filepath.replace(/\.[^\.]+$/, "");
    }
    /**
     * Removes any extra charactrs so that we are just left with the relative path.
     * @param source from importDef.source - the import location
     * @returns A cleaner import location
     */
    static cleanSource(source) {
        // Remove any Webpack URL things 
        return source.replace(/\?.*$/, "");
    }
    /**
     * Uses the glob library to search for files.
     * @param pattern The gob pattern describing the files to search for.
     * @returns A list of all absolute filepaths matching the pattern.
     */
    static async asyncGlob(pattern) {
        return new Promise((res, rej) => (0, glob_1.glob)(pattern, { absolute: true }, (error, matches) => {
            if (error) {
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
    static isRelativeImport(source) {
        return source.startsWith('.');
    }
    /**
     * Tries to replicate Typescript's import resolution search pattern.
     * @param fileLocation The source file's filepath.
     * @param source The relative filepath from the last part of the import statement.
     * @returns A list of file paths
     */
    static listPossiblePaths(fileLocation, source) {
        const pathOne = path_1.default.join(path_1.default.join(fileLocation, ".."), source);
        if (ImportRefactorer.hasFileExtension(fileLocation)) {
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
        for (const fileExtension of fileExtensions) {
            results.push(pathOne + fileExtension);
        }
        const indexFilenames = [
            'index.ts',
            'index.tsx',
            'index.d.ts',
            'index.js',
            'index.jsx'
        ];
        for (const indexFilename of indexFilenames) {
            results.push(path_1.default.join(pathOne, indexFilename));
        }
        return results;
    }
    /**
     * Checks to see if the filepath has a file extension, or if a filepath will need to be added.
     * @param filepath The filepath to check
     * @returns True if the filename has a "something.ext" format.
     */
    static hasFileExtension(filepath) {
        return /(\.[A-Z0-9])?\.[A-Z0-9]$/i.test(filepath);
    }
    /**
     * Returns true if the file exists and is a file.
     * @param filepath The file to check
     */
    static async isFile(filepath) {
        try {
            const stat = await fs_1.default.promises.lstat(filepath);
            return stat.isFile();
        }
        catch (ex) {
            return false;
        }
    }
}
exports.default = ImportRefactorer;
//# sourceMappingURL=ImportRefactorer.js.map