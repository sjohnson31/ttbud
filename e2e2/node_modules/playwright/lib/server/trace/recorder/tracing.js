"use strict";
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tracing = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const util_1 = __importDefault(require("util"));
const yazl_1 = __importDefault(require("yazl"));
const utils_1 = require("../../../utils/utils");
const artifact_1 = require("../../artifact");
const browserContext_1 = require("../../browserContext");
const frames_1 = require("../../frames");
const helper_1 = require("../../helper");
const page_1 = require("../../page");
const traceSnapshotter_1 = require("./traceSnapshotter");
const fsAppendFileAsync = util_1.default.promisify(fs_1.default.appendFile.bind(fs_1.default));
const fsWriteFileAsync = util_1.default.promisify(fs_1.default.writeFile.bind(fs_1.default));
const fsMkdirAsync = util_1.default.promisify(fs_1.default.mkdir.bind(fs_1.default));
class Tracing {
    constructor(context) {
        this._appendEventChain = Promise.resolve();
        this._eventListeners = [];
        this._pendingCalls = new Map();
        this._sha1s = [];
        this._started = false;
        this._context = context;
        this._traceDir = context._browser.options.traceDir;
        this._resourcesDir = path_1.default.join(this._traceDir || '', 'resources');
        this._snapshotter = new traceSnapshotter_1.TraceSnapshotter(this._context, this._resourcesDir, traceEvent => this._appendTraceEvent(traceEvent));
    }
    async start(options) {
        // context + page must be the first events added, this method can't have awaits before them.
        if (!this._traceDir)
            throw new Error('Tracing directory is not specified when launching the browser');
        if (this._started)
            throw new Error('Tracing has already been started');
        this._started = true;
        this._traceFile = path_1.default.join(this._traceDir, (options.name || utils_1.createGuid()) + '.trace');
        this._appendEventChain = utils_1.mkdirIfNeeded(this._traceFile);
        const event = {
            timestamp: utils_1.monotonicTime(),
            type: 'context-metadata',
            browserName: this._context._browser.options.name,
            isMobile: !!this._context._options.isMobile,
            deviceScaleFactor: this._context._options.deviceScaleFactor || 1,
            viewportSize: this._context._options.viewport || undefined,
            debugName: this._context._options._debugName,
        };
        this._appendTraceEvent(event);
        for (const page of this._context.pages())
            this._onPage(options.screenshots, page);
        this._eventListeners.push(helper_1.helper.addEventListener(this._context, browserContext_1.BrowserContext.Events.Page, this._onPage.bind(this, options.screenshots)));
        // context + page must be the first events added, no awaits above this line.
        await fsMkdirAsync(this._resourcesDir, { recursive: true });
        this._context.instrumentation.addListener(this);
        if (options.snapshots)
            await this._snapshotter.start();
    }
    async stop() {
        if (!this._started)
            return;
        this._started = false;
        this._context.instrumentation.removeListener(this);
        helper_1.helper.removeEventListeners(this._eventListeners);
        for (const { sdkObject, metadata } of this._pendingCalls.values())
            await this.onAfterCall(sdkObject, metadata);
        for (const page of this._context.pages())
            page.setScreencastEnabled(false);
        // Ensure all writes are finished.
        await this._appendEventChain;
    }
    async dispose() {
        await this._snapshotter.dispose();
    }
    async export() {
        if (!this._traceFile)
            throw new Error('Tracing directory is not specified when launching the browser');
        const zipFile = new yazl_1.default.ZipFile();
        zipFile.addFile(this._traceFile, 'trace.trace');
        const zipFileName = this._traceFile + '.zip';
        this._traceFile = undefined;
        for (const sha1 of this._sha1s)
            zipFile.addFile(path_1.default.join(this._resourcesDir, sha1), path_1.default.join('resources', sha1));
        zipFile.end();
        await new Promise(f => {
            zipFile.outputStream.pipe(fs_1.default.createWriteStream(zipFileName)).on('close', f);
        });
        const artifact = new artifact_1.Artifact(this._context, zipFileName);
        artifact.reportFinished();
        return artifact;
    }
    async _captureSnapshot(name, sdkObject, metadata, element) {
        if (!sdkObject.attribution.page)
            return;
        if (!this._snapshotter.started())
            return;
        const snapshotName = `${name}@${metadata.id}`;
        metadata.snapshots.push({ title: name, snapshotName });
        await this._snapshotter.captureSnapshot(sdkObject.attribution.page, snapshotName, element);
    }
    async onBeforeCall(sdkObject, metadata) {
        await this._captureSnapshot('before', sdkObject, metadata);
        this._pendingCalls.set(metadata.id, { sdkObject, metadata });
    }
    async onBeforeInputAction(sdkObject, metadata, element) {
        await this._captureSnapshot('action', sdkObject, metadata, element);
    }
    async onAfterCall(sdkObject, metadata) {
        if (!this._pendingCalls.has(metadata.id))
            return;
        this._pendingCalls.delete(metadata.id);
        if (!sdkObject.attribution.page)
            return;
        await this._captureSnapshot('after', sdkObject, metadata);
        const event = {
            timestamp: metadata.startTime,
            type: 'action',
            metadata,
        };
        this._appendTraceEvent(event);
    }
    onEvent(sdkObject, metadata) {
        if (!sdkObject.attribution.page)
            return;
        const event = {
            timestamp: metadata.startTime,
            type: 'event',
            metadata,
        };
        this._appendTraceEvent(event);
    }
    _onPage(screenshots, page) {
        const pageId = page.guid;
        const event = {
            timestamp: utils_1.monotonicTime(),
            type: 'page-created',
            pageId,
        };
        this._appendTraceEvent(event);
        if (screenshots)
            page.setScreencastEnabled(true);
        this._eventListeners.push(helper_1.helper.addEventListener(page, page_1.Page.Events.Dialog, (dialog) => {
            const event = {
                timestamp: utils_1.monotonicTime(),
                type: 'dialog-opened',
                pageId,
                dialogType: dialog.type(),
                message: dialog.message(),
            };
            this._appendTraceEvent(event);
        }), helper_1.helper.addEventListener(page, page_1.Page.Events.InternalDialogClosed, (dialog) => {
            const event = {
                timestamp: utils_1.monotonicTime(),
                type: 'dialog-closed',
                pageId,
                dialogType: dialog.type(),
            };
            this._appendTraceEvent(event);
        }), helper_1.helper.addEventListener(page.mainFrame(), frames_1.Frame.Events.Navigation, (navigationEvent) => {
            if (page.mainFrame().url() === 'about:blank')
                return;
            const event = {
                timestamp: utils_1.monotonicTime(),
                type: 'navigation',
                pageId,
                url: navigationEvent.url,
                sameDocument: !navigationEvent.newDocument,
            };
            this._appendTraceEvent(event);
        }), helper_1.helper.addEventListener(page, page_1.Page.Events.Load, () => {
            if (page.mainFrame().url() === 'about:blank')
                return;
            const event = {
                timestamp: utils_1.monotonicTime(),
                type: 'load',
                pageId,
            };
            this._appendTraceEvent(event);
        }), helper_1.helper.addEventListener(page, page_1.Page.Events.ScreencastFrame, params => {
            const sha1 = utils_1.calculateSha1(utils_1.createGuid()); // no need to compute sha1 for screenshots
            const event = {
                type: 'screencast-frame',
                pageId: page.guid,
                sha1,
                pageTimestamp: params.timestamp,
                width: params.width,
                height: params.height,
                timestamp: utils_1.monotonicTime()
            };
            this._appendTraceEvent(event);
            this._appendEventChain = this._appendEventChain.then(async () => {
                await fsWriteFileAsync(path_1.default.join(this._resourcesDir, sha1), params.buffer).catch(() => { });
            });
        }), helper_1.helper.addEventListener(page, page_1.Page.Events.Close, () => {
            const event = {
                timestamp: utils_1.monotonicTime(),
                type: 'page-destroyed',
                pageId,
            };
            this._appendTraceEvent(event);
        }));
    }
    _appendTraceEvent(event) {
        const visit = (object) => {
            if (Array.isArray(object)) {
                object.forEach(visit);
                return;
            }
            if (typeof object === 'object') {
                for (const key in object) {
                    if (key === 'sha1' || key.endsWith('Sha1')) {
                        const sha1 = object[key];
                        if (sha1)
                            this._sha1s.push(sha1);
                    }
                    visit(object[key]);
                }
                return;
            }
        };
        visit(event);
        // Serialize all writes to the trace file.
        this._appendEventChain = this._appendEventChain.then(async () => {
            await fsAppendFileAsync(this._traceFile, JSON.stringify(event) + '\n');
        });
    }
}
exports.Tracing = Tracing;
//# sourceMappingURL=tracing.js.map