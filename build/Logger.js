"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Logger {
    static debug(message) {
        if (Logger.verbose) {
            console.log(message);
        }
    }
    static log(message) {
        console.log(message);
    }
}
exports.default = Logger;
Logger.verbose = false;
//# sourceMappingURL=Logger.js.map