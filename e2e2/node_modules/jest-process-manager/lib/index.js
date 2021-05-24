"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.teardown = exports.getServers = exports.setup = exports.JestProcessManagerError = void 0;
/* eslint-disable no-console */
const stream_1 = __importDefault(require("stream"));
const net_1 = __importDefault(require("net"));
const chalk_1 = __importDefault(require("chalk"));
const cwd_1 = __importDefault(require("cwd"));
const wait_on_1 = __importDefault(require("wait-on"));
const find_process_1 = __importDefault(require("find-process"));
const util_1 = require("util");
const tree_kill_1 = __importDefault(require("tree-kill"));
const prompts_1 = __importDefault(require("prompts"));
const child_process_1 = require("child_process");
const exit_1 = __importDefault(require("exit"));
const signal_exit_1 = __importDefault(require("signal-exit"));
const constants_1 = require("./constants");
const pTreeKill = util_1.promisify(tree_kill_1.default);
const pExec = util_1.promisify(child_process_1.exec);
function spawnd(command, options) {
    const proc = child_process_1.spawn(command, options);
    const cleanExit = (code = 1) => {
        if (proc === null || proc === void 0 ? void 0 : proc.pid) {
            tree_kill_1.default(proc.pid, () => exit_1.default(code));
        }
        else {
            exit_1.default(code);
        }
    };
    if (proc.stderr !== null) {
        proc.stderr.pipe(process.stderr);
    }
    proc.on('exit', cleanExit);
    proc.on('error', () => cleanExit(1));
    const removeExitHandler = signal_exit_1.default(code => {
        cleanExit(typeof code === 'number' ? code : 1);
    });
    proc.destroy = async () => {
        removeExitHandler();
        proc.removeAllListeners('exit');
        proc.removeAllListeners('error');
        return pTreeKill(proc.pid).catch(() => {
            /* ignore error */
        });
    };
    return proc;
}
const createServerLogPrefix = () => new stream_1.default.Transform({
    transform(chunk, encoding, callback) {
        this.push(chalk_1.default.magentaBright(`[Jest Process Manager] ${chunk.toString()}`));
        callback();
    },
});
class JestProcessManagerError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
    }
}
exports.JestProcessManagerError = JestProcessManagerError;
const servers = [];
const logProcDetection = (procName, port) => {
    console.log(chalk_1.default.blue(`🕵️  Detecting a process "${procName}" running on port "${port}"`));
};
async function killProc(proc) {
    console.log(chalk_1.default.yellow(`Killing process ${proc.name}...`));
    await pTreeKill(proc.pid);
    console.log(chalk_1.default.green(`Successfully killed process ${proc.name}`));
}
function runServer(config, index) {
    var _a;
    if (!config.command) {
        throw new JestProcessManagerError('You must define a `command`', constants_1.ERROR_NO_COMMAND);
    }
    servers[index] = spawnd(config.command, {
        shell: true,
        cwd: cwd_1.default(),
        ...config.options,
        env: {
            ...process.env,
            ...(((_a = config.options) === null || _a === void 0 ? void 0 : _a.env) ? config.options.env : {})
        }
    });
    if (config.debug) {
        console.log(chalk_1.default.magentaBright('\nJest dev-server output:'));
        servers[index].stdout.pipe(createServerLogPrefix()).pipe(process.stdout);
    }
}
async function outOfStin(block) {
    const { stdin } = process;
    const listeners = stdin.listeners('data');
    const result = await block();
    listeners.forEach(listener => stdin.on('data', listener));
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();
    return result;
}
async function getIsPortTaken(config) {
    // TODO Make it configurable through config?
    const timeout = 1000;
    const { port, host } = config;
    const promise = new Promise(((resolve, reject) => {
        const socket = new net_1.default.Socket();
        const onError = () => {
            socket.destroy();
            reject();
        };
        socket.setTimeout(timeout);
        socket.once('error', onError);
        socket.once('timeout', onError);
        socket.connect(port, host, () => {
            socket.end();
            resolve(true);
        });
    }));
    try {
        await promise;
        return true;
    }
    catch (_) {
        return false;
    }
}
const basePathUrlPostfix = (basePath) => {
    if (basePath) {
        return basePath.startsWith('/') ? basePath : `/${basePath}`;
    }
    return '';
};
async function setup(providedConfigs) {
    // Compatible with older versions
    const configs = Array.isArray(providedConfigs)
        ? providedConfigs
        : [providedConfigs];
    await Promise.all(configs.map((providedConfig, index) => setupJestServer(providedConfig, index)));
}
exports.setup = setup;
async function setupJestServer(providedConfig, index) {
    const config = { ...constants_1.DEFAULT_CONFIG, ...providedConfig };
    const usedPortHandlers = {
        error() {
            throw new JestProcessManagerError(`Port ${config.port} is in use`, constants_1.ERROR_PORT_USED);
        },
        async kill() {
            console.log('');
            console.log(`Killing process listening to ${config.port}. On linux, this may require you to enter your password.`);
            const [portProcess] = await find_process_1.default('port', config.port);
            logProcDetection(portProcess.name, config.port);
            await killProc(portProcess);
        },
        async ask() {
            console.log('');
            const answers = await outOfStin(() => prompts_1.default({
                type: 'confirm',
                name: 'kill',
                message: `Another process is listening on ${config.port}. Should I kill it for you? On linux, this may require you to enter your password.`,
                initial: true,
            }));
            if (answers.kill) {
                const [portProcess] = await find_process_1.default('port', config.port);
                logProcDetection(portProcess.name, config.port);
                await killProc(portProcess);
            }
            else {
                process.exit(1);
            }
        },
        ignore() { },
    };
    const usedPortHandler = usedPortHandlers[config.usedPortAction];
    if (!usedPortHandler) {
        const availableActions = Object.keys(usedPortHandlers)
            .map(action => `\`${action}\``)
            .join(', ');
        throw new JestProcessManagerError(`Invalid \`usedPortAction\`, only ${availableActions} are possible`);
    }
    if (config.port) {
        const { launchTimeout, protocol, host, port, basePath, waitOnScheme } = config;
        const isPortTaken = await getIsPortTaken(config);
        if (isPortTaken) {
            await usedPortHandler();
        }
        if (config.usedPortAction === 'ignore' && isPortTaken) {
            console.log('');
            console.log('Port is already taken. Assuming server is already running.');
        }
        else {
            runServer(config, index);
        }
        const urlPostfix = basePathUrlPostfix(basePath);
        let url = `${protocol}://${host}:${port}${urlPostfix}`;
        if (protocol === 'tcp' || protocol === 'socket') {
            url = `${protocol}:${host}:${port}${urlPostfix}`;
        }
        const opts = {
            resources: [url],
            timeout: launchTimeout,
            ...waitOnScheme,
        };
        try {
            await wait_on_1.default(opts);
        }
        catch (err) {
            const [portProcess] = await find_process_1.default('port', config.port);
            if (portProcess) {
                await killProc(portProcess);
            }
            throw new JestProcessManagerError(`Server has taken more than ${launchTimeout}ms to start.`, constants_1.ERROR_TIMEOUT);
        }
    }
    else {
        runServer(config, index);
    }
}
function getServers() {
    return servers;
}
exports.getServers = getServers;
async function teardown(command) {
    if (servers.length) {
        await Promise.all(servers.map(server => server.destroy()));
    }
    if (command) {
        try {
            await pExec(command);
        }
        catch (e) {
            console.error(e);
        }
    }
}
exports.teardown = teardown;
