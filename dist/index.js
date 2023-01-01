"use strict";
/**
 * Copyright 2015-present Ampersand Technologies, Inc.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebFileStore = exports.FileStoreTransaction = exports.encodeKeysToFilenames = exports.decodeKeyFromFilename = exports.encodeKeyToFilename = void 0;
var index_1 = require("amper-promise-utils/dist/index");
var JsonUtils = require("amper-utils/dist/jsonUtils");
function encodeKeyToFilename(dbkey) {
    var dst = '';
    var prev = '';
    for (var i = 0; i < dbkey.length; i++) {
        var code = dbkey.charCodeAt(i);
        var char = dbkey[i];
        if (prev !== '^') {
            if (code >= 65 && code <= 90) {
                dst += '^' + char;
            }
            else if (char === ':') {
                dst += '^+';
            }
            else {
                dst += char;
            }
        }
        else {
            dst += char;
        }
        prev = char;
    }
    return dst;
}
exports.encodeKeyToFilename = encodeKeyToFilename;
function decodeKeyFromFilename(fsKey) {
    var dst = '';
    var upCase = false;
    for (var i = 0; i < fsKey.length; i++) {
        var c = fsKey[i];
        if (c === '^') {
            upCase = true;
        }
        else {
            if (upCase) {
                if (c === '+') {
                    c = ':';
                }
                else {
                    c = c.toUpperCase();
                }
                upCase = false;
            }
            dst += c;
        }
    }
    return dst;
}
exports.decodeKeyFromFilename = decodeKeyFromFilename;
function encodeKeysToFilenames(dbKeys) {
    var fsKeys = new Array(dbKeys.length);
    for (var i = 0; i < dbKeys.length; i++) {
        fsKeys[i] = encodeKeyToFilename(dbKeys[i]);
    }
    return fsKeys;
}
exports.encodeKeysToFilenames = encodeKeysToFilenames;
function errorFromEvent(ev) {
    var _a;
    var error = (_a = ev.target) === null || _a === void 0 ? void 0 : _a.error;
    return {
        name: (error === null || error === void 0 ? void 0 : error.name) || '',
        message: (error === null || error === void 0 ? void 0 : error.message) || '',
    };
}
var FileStoreTransaction = /** @class */ (function () {
    function FileStoreTransaction(store) {
        this.store = store;
    }
    FileStoreTransaction.prototype.find = function (path, cb) {
        var request = this.store.get(path);
        request.onsuccess = function () {
            var data;
            try {
                data = request.result ? JSON.parse(request.result.data) : undefined; // @allowJsonFuncs
            }
            catch (eIgnored) {
                // do nothing
            }
            cb(null, data);
        };
        request.onerror = function (ev) {
            cb(errorFromEvent(ev));
        };
    };
    FileStoreTransaction.prototype.findDir = function (path, cb) {
        if (path[path.length - 1] !== '/') {
            cb(new Error('/ required at end of path'));
            return;
        }
        var words = path.split('/');
        var indexCount = words.length - 1;
        if (indexCount > 3) {
            cb(new Error('max dir depth 3'));
            return;
        }
        var index = this.store.index('d' + indexCount);
        var cursor;
        var ret = { paths: [], objects: [], errors: null };
        try {
            cursor = index.openCursor(IDBKeyRange.only(words.slice(0, indexCount)));
        }
        catch (e) {
            console.error('idbDataError', { words: words, indexCount: indexCount, path: path, err: e });
            cb('idbDataError');
            return;
        }
        cursor.onsuccess = function (ev) {
            var result = ev.target.result;
            if (result) {
                try {
                    var data = JSON.parse(result.value.data); // @allowJsonFuncs
                    ret.paths.push(result.value.path);
                    ret.objects.push(data);
                }
                catch (ex) {
                    ret.errors = ret.errors || {};
                    ret.errors[result.value.path] = '' + ex;
                }
                result.continue();
            }
            else {
                cb(undefined, ret);
            }
        };
        cursor.onerror = function (ev) {
            cb(errorFromEvent(ev.target));
        };
    };
    FileStoreTransaction.prototype.updateRaw = function (path, objStr, cb) {
        var words = path.split('/');
        var request = this.store.put({
            data: objStr,
            path: path,
            dir1: words[0] || '.',
            dir2: words[1] || '.',
            dir3: words[2] || '.',
        });
        request.onsuccess = function () {
            cb();
        };
        request.onerror = function (ev) {
            cb(errorFromEvent(ev));
        };
    };
    FileStoreTransaction.prototype.updateObj = function (path, obj, cb) {
        this.updateRaw(path, JsonUtils.safeStringify(obj), cb);
    };
    FileStoreTransaction.prototype.remove = function (path, cb) {
        var request = this.store.delete(path);
        request.onsuccess = function () {
            cb();
        };
        request.onerror = function (ev) {
            cb(errorFromEvent(ev));
        };
    };
    FileStoreTransaction.prototype.removeList = function (paths, cb) {
        var _this = this;
        if (!paths.length) {
            cb();
            return;
        }
        this.remove(paths[0], function (err) {
            if (err) {
                console.error('Failed to remove file', paths[0]);
            }
            _this.removeList(paths.slice(1), cb);
        });
    };
    FileStoreTransaction.prototype.removeDir = function (path, cb) {
        if (path[path.length - 1] !== '/') {
            cb(new Error('/ required at end of path'));
            return;
        }
        var words = path.split('/');
        var indexCount = words.length - 1;
        if (indexCount > 3) {
            cb(new Error('max dir depth 3'));
            return;
        }
        var index = this.store.index('d' + indexCount);
        var cursor;
        try {
            cursor = index.openCursor(IDBKeyRange.only(words.slice(0, indexCount)));
        }
        catch (e) {
            console.error('idbDataError', { words: words, indexCount: indexCount, path: path, err: e });
            return cb();
        }
        cursor.onsuccess = function (ev) {
            var result = ev.target.result;
            if (result) {
                result.delete(result.value.path);
                result.continue();
            }
            else {
                cb();
            }
        };
        cursor.onerror = function (ev) {
            cb(errorFromEvent(ev));
        };
    };
    FileStoreTransaction.prototype.removeAllExcept = function (exceptPaths, cb) {
        var cursor = this.store.openCursor();
        cursor.onsuccess = function (ev) {
            var result = ev.target.result;
            if (result) {
                var i = void 0;
                for (i = exceptPaths.length - 1; i >= 0; i--) {
                    if (result.value.path.indexOf(exceptPaths[i]) === 0) {
                        break;
                    }
                }
                if (i < 0) {
                    result.delete(result.value.path);
                }
                result.continue();
            }
            else {
                cb();
            }
        };
        cursor.onerror = function (ev) {
            cb(errorFromEvent(ev));
        };
    };
    return FileStoreTransaction;
}());
exports.FileStoreTransaction = FileStoreTransaction;
var WebFileStoreDB = /** @class */ (function () {
    function WebFileStoreDB() {
        var _this = this;
        this.fsTableName = 'fs';
        this.dbKeys = ['path', 'dir1', 'dir2', 'dir3'];
        this.transact = function (type, func) { return __awaiter(_this, void 0, void 0, function () {
            var promise, error, result, transaction, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        promise = new index_1.ResolvablePromise();
                        transaction = this.indexedDB.transaction(this.fsTableName, type);
                        transaction.onerror = function (ev) {
                            promise.reject(errorFromEvent(ev));
                        };
                        transaction.onabort = function (ev) {
                            promise.reject(errorFromEvent(ev));
                        };
                        transaction.oncomplete = function (_evIgnored) {
                            promise.settle(error, result);
                        };
                        store = transaction.objectStore(this.fsTableName);
                        func(new FileStoreTransaction(store), function (err, data) {
                            error = err;
                            result = data;
                        });
                        return [4 /*yield*/, promise.promise];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); };
    }
    WebFileStoreDB.prototype.init = function (dbName, clearDB) {
        if (dbName === void 0) { dbName = 'db'; }
        if (clearDB === void 0) { clearDB = false; }
        return __awaiter(this, void 0, void 0, function () {
            var request, promise;
            var _this = this;
            return __generator(this, function (_a) {
                request = window.indexedDB.open(dbName, 1);
                if (!request) {
                    throw new Error('indexedDB failed to open');
                }
                promise = new index_1.ResolvablePromise();
                request.onerror = function (ev) {
                    var error = errorFromEvent(ev);
                    console.error('indexedDB.request.onerror', { db: dbName, error: error });
                    promise.reject(error);
                };
                request.onsuccess = function (ev) {
                    _this.indexedDB = ev.target.result;
                    _this.indexedDB.onerror = function (ev2) {
                        var error = errorFromEvent(ev2);
                        console.error('indexedDB.onerror', { db: dbName, error: error });
                    };
                    _this.indexedDB.onversionchange = function () {
                        _this.indexedDB.close();
                        // TODO notify need for page refresh
                        // Navigation.hardPageRefresh();
                    };
                    if (clearDB) {
                        _this.createTable(true);
                    }
                    promise.resolve();
                };
                request.onupgradeneeded = function (ev) {
                    _this.indexedDB = ev.target.result;
                    _this.createTable(clearDB || Boolean(ev.oldVersion && ev.oldVersion !== ev.newVersion));
                    clearDB = false;
                };
                return [2 /*return*/];
            });
        });
    };
    WebFileStoreDB.prototype.createTable = function (deleteTable) {
        if (deleteTable) {
            try {
                this.indexedDB.deleteObjectStore(this.fsTableName);
            }
            catch (e) {
                // ignore
            }
        }
        try {
            var store = this.indexedDB.createObjectStore(this.fsTableName, { keyPath: this.dbKeys[0] });
            for (var i = 1; i < this.dbKeys.length; i++) {
                store.createIndex('d' + i, this.dbKeys.slice(1, i + 1), { unique: false });
            }
        }
        catch (e) {
            // ignore
        }
    };
    return WebFileStoreDB;
}());
var WebFileStore = /** @class */ (function () {
    function WebFileStore() {
        var _this = this;
        this.fileStoreDB = new WebFileStoreDB();
        this.localHandlers = {};
        this.localStorageFailed = false;
        this.localReceive = function (ev) {
            if (ev.key === 'message' && ev.newValue) {
                var message = JsonUtils.safeParse(ev.newValue);
                if (!message || message.length !== 2) {
                    return;
                }
                var cmd = message[0];
                var obj = message[1];
                if (_this.localHandlers[cmd]) {
                    try {
                        _this.localHandlers[cmd](cmd, obj);
                    }
                    catch (e) {
                    }
                }
            }
        };
        this.executor = new index_1.SerialExecutor();
        window.addEventListener('storage', this.localReceive);
    }
    WebFileStore.prototype.init = function (dbName, clearDB) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fileStoreDB.init(dbName, clearDB)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    WebFileStore.prototype.registerLocalMessageHandler = function (msg, handler) {
        this.localHandlers[msg] = handler;
    };
    WebFileStore.prototype.localBroadcast = function (cmd, obj) {
        if (this.localStorageFailed) {
            return; // gets in the way of breakpointing exceptions
        }
        try {
            localStorage.setItem('message', JsonUtils.safeStringify([cmd, obj]));
            localStorage.removeItem('message');
        }
        catch (e) {
            this.localStorageFailed = true;
        }
    };
    WebFileStore.prototype.transact = function (type, func) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.executor.run(this.fileStoreDB.transact, type, func)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    WebFileStore.prototype.isInMutex = function () {
        return this.executor.isBusy();
    };
    WebFileStore.prototype.flushWrites = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.find('')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    WebFileStore.prototype.find = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.transact('readonly', function (tx, cb) {
                            tx.find(path, cb);
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    WebFileStore.prototype.findDir = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.transact('readonly', function (tx, cb) {
                            tx.findDir(path, cb);
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    WebFileStore.prototype.update = function (path, obj) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.transact('readwrite', function (tx, cb) {
                            tx.updateObj(path, obj, cb);
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    WebFileStore.prototype.updateRaw = function (path, objStr) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.transact('readwrite', function (tx, cb) {
                            tx.updateRaw(path, objStr, cb);
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    WebFileStore.prototype.remove = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.transact('readwrite', function (tx, cb) {
                            tx.remove(path, cb);
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    WebFileStore.prototype.removeList = function (paths) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.transact('readwrite', function (tx, cb) {
                            tx.removeList(paths, cb);
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    WebFileStore.prototype.removeDir = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.transact('readwrite', function (tx, cb) {
                            tx.removeDir(path, cb);
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    WebFileStore.prototype.removeAllExcept = function (exceptPaths) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.transact('readwrite', function (tx, cb) {
                            tx.removeAllExcept(exceptPaths, cb);
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    WebFileStore.prototype.windowReadAll = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // noop on web, this is meant for multi-window desktop apps
                return [2 /*return*/, {}];
            });
        });
    };
    WebFileStore.prototype.windowWrite = function (_key, _data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/];
            });
        });
    };
    return WebFileStore;
}());
exports.WebFileStore = WebFileStore;
