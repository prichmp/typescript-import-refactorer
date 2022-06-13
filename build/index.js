"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = __importDefault(require("fs"));
const yargs_1 = __importDefault(require("yargs"));
const ImportRefactorer_1 = __importDefault(require("./ImportRefactorer"));
const ts_morph_1 = require("ts-morph");
const Logger_1 = __importDefault(require("./Logger"));
/**
 * "source": is a glob that should match the files that have bad imports
 * "imports": Is a glob containing the entire possilbe import files
 */
const options = yargs_1.default
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
    .option('verbose', {
    alias: 'v',
    boolean: true,
    default: false
})
    .argv;
(async () => {
    const fulfilledOptions = await options;
    const sourceCodeFilepaths = await ImportRefactorer_1.default.asyncGlob(fulfilledOptions.source);
    const possibleImports = await ImportRefactorer_1.default.asyncGlob(fulfilledOptions.imports);
    const project = new ts_morph_1.Project({
        tsConfigFilePath: fulfilledOptions['ts-config'],
        //skipAddingFilesFromTsConfig: true,
    });
    Logger_1.default.verbose = fulfilledOptions['verbose'];
    Logger_1.default.log(`Found ${sourceCodeFilepaths.length} source code files`);
    Logger_1.default.log(`Found ${possibleImports.length} possible imports`);
    const sourceFiles = project.getSourceFiles();
    Logger_1.default.log(`Typescript project includes ${sourceFiles.length} source files`);
    for (const sourceCodeFilepath of sourceCodeFilepaths) {
        const fileContents = await readFile(sourceCodeFilepath);
        const sourceCode = project.createSourceFile(sourceCodeFilepath, fileContents, { overwrite: true });
        if (!sourceCode) {
            Logger_1.default.debug(chalk_1.default.red(`Could not find file "${sourceCodeFilepath}"`));
            continue;
        }
        try {
            const newCode = await ImportRefactorer_1.default.rewriteImports(sourceCode, sourceCodeFilepath, possibleImports);
            if (!fulfilledOptions['dry-run']) {
                await newCode.save();
                Logger_1.default.log(`Wrote out new code to "${sourceCodeFilepath}"`);
            }
        }
        catch (ex) {
            Logger_1.default.log(chalk_1.default.red(`Could not process file "${sourceCodeFilepath}"`));
            Logger_1.default.log(ex);
        }
    }
    async function readFile(filepath) {
        Logger_1.default.debug(`Opening file "${filepath}"`);
        const data = await fs_1.default.promises.readFile(filepath, 'utf8');
        return data;
    }
    async function writeFile(filepath, contents) {
        await fs_1.default.promises.writeFile(filepath, contents, 'utf8');
    }
})();
//# sourceMappingURL=index.js.map