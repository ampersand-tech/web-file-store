/**
 * Copyright 2015-present Ampersand Technologies, Inc.
 */

import { ResolvablePromise, SerialExecutor } from 'amper-promise-utils/dist/index';
import * as JsonUtils from 'amper-utils/dist/jsonUtils';
import { ErrDataCB, ErrorType, Stash } from 'amper-utils/dist/types';
import { FindDirData, IFileStore } from 'data-store/dist/dataStorePersist';

export type TransactionFunc<T> = (transaction: FileStoreTransaction, cb: ErrDataCB<T>) => void;

export type LocalMessageHandler = (cmd: string, obj: any) => void;

export function encodeKeyToFilename(dbkey: string) {
  let dst = '';
  let prev = '';
  for (let i = 0; i < dbkey.length; i++) {
    let code = dbkey.charCodeAt(i);
    let char = dbkey[i];
    if (prev !== '^') {
      if (code >= 65 && code <= 90) {
        dst += '^' + char;
      } else if (char === ':') {
        dst += '^+';
      } else {
        dst += char;
      }
    } else {
      dst += char;
    }
    prev = char;
  }
  return dst;
}

export function decodeKeyFromFilename(fsKey: string) {
  let dst = '';
  let upCase = false;
  for (let i = 0; i < fsKey.length; i++) {
    let c = fsKey[i];
    if (c === '^') {
      upCase = true;
    } else {
      if (upCase) {
        if (c === '+') {
          c = ':';
        } else {
          c = c.toUpperCase();
        }
        upCase = false;
      }
      dst += c;
    }
  }
  return dst;
}

export function encodeKeysToFilenames(dbKeys: string[]) {
  let fsKeys = new Array(dbKeys.length);
  for (let i = 0; i < dbKeys.length; i++) {
    fsKeys[i] = encodeKeyToFilename(dbKeys[i]);
  }
  return fsKeys;
}

function errorFromEvent(ev: Event) {
  const error = (ev.target as any)?.error;
  return {
    name: error?.name as string || '',
    message: error?.message as string || '',
  };
}

export class FileStoreTransaction {
  constructor(private readonly store: IDBObjectStore) {
  }

  find<T>(path: string, cb: ErrDataCB<T | undefined>) {
    const request = this.store.get(path);
    request.onsuccess = () => {
      let data: T | undefined;
      try {
        data = request.result ? JSON.parse(request.result.data) : undefined; // @allowJsonFuncs
      } catch (eIgnored) {
        // do nothing
      }
      cb(null, data);
    };
    request.onerror = (ev) => {
      cb(errorFromEvent(ev));
    };
  }

  findDir<T>(path: string, cb: ErrDataCB<FindDirData<T>>) {
    if (path[path.length - 1] !== '/') {
      cb(new Error('/ required at end of path'));
      return;
    }

    const words = path.split('/');
    const indexCount = words.length - 1;
    if (indexCount > 3) {
      cb(new Error('max dir depth 3'));
      return;
    }

    const index = this.store.index('d' + indexCount);
    let cursor;
    const ret: FindDirData<T> = { paths: [], objects: [], errors: null };
    try {
      cursor = index.openCursor(IDBKeyRange.only(words.slice(0, indexCount)));
    } catch (e) {
      console.error('idbDataError', { words: words, indexCount: indexCount, path: path, err: e });
      cb('idbDataError');
      return;
    }
    cursor.onsuccess = (ev) => {
      const result = ev.target.result;
      if (result) {
        try {
          const data = JSON.parse(result.value.data); // @allowJsonFuncs
          ret.paths.push(result.value.path);
          ret.objects.push(data);
        } catch (ex) {
          ret.errors = ret.errors || {};
          ret.errors[result.value.path] = '' + ex;
        }
        result.continue();
      } else {
        cb(undefined, ret);
      }
    };
    cursor.onerror = (ev) => {
      cb(errorFromEvent(ev.target));
    };
  }

  updateRaw(path: string, objStr: string, cb: ErrDataCB<void>) {
    const words = path.split('/');
    const request = this.store.put({
      data: objStr,
      path: path,
      dir1: words[0] || '.',
      dir2: words[1] || '.',
      dir3: words[2] || '.',
    });
    request.onsuccess = () => {
      cb();
    };
    request.onerror = (ev) => {
      cb(errorFromEvent(ev));
    };
  }

  updateObj(path: string, obj: any, cb: ErrDataCB<void>) {
    this.updateRaw(path, JsonUtils.safeStringify(obj), cb);
  }

  remove(path: string, cb: ErrDataCB<void>) {
    const request = this.store.delete(path);
    request.onsuccess = () => {
      cb();
    };
    request.onerror = (ev) => {
      cb(errorFromEvent(ev));
    };
  }

  removeList(paths: string[], cb: ErrDataCB<void>) {
    if (!paths.length) {
      cb();
      return;
    }
    this.remove(paths[0], err => {
      if (err) {
        console.error('Failed to remove file', paths[0]);
      }
      this.removeList(paths.slice(1), cb);
    });
  }

  removeDir(path: string, cb: ErrDataCB<void>) {
    if (path[path.length - 1] !== '/') {
      cb(new Error('/ required at end of path'));
      return;
    }

    const words = path.split('/');
    const indexCount = words.length - 1;
    if (indexCount > 3) {
      cb(new Error('max dir depth 3'));
      return;
    }

    const index = this.store.index('d' + indexCount);
    let cursor;
    try {
      cursor = index.openCursor(IDBKeyRange.only(words.slice(0, indexCount)));
    } catch (e) {
      console.error('idbDataError', { words: words, indexCount: indexCount, path: path, err: e });
      return cb();
    }
    cursor.onsuccess = (ev) => {
      const result = ev.target.result;
      if (result) {
        result.delete(result.value.path);
        result.continue();
      } else {
        cb();
      }
    };
    cursor.onerror = (ev) => {
      cb(errorFromEvent(ev));
    };
  }

  removeAllExcept(exceptPaths: string[], cb: ErrDataCB<void>) {
    const cursor = this.store.openCursor();
    cursor.onsuccess = (ev) => {
      const result = (ev.target as any).result;
      if (result) {
        let i;
        for (i = exceptPaths.length - 1; i >= 0; i--) {
          if (result.value.path.indexOf(exceptPaths[i]) === 0) {
            break;
          }
        }
        if (i < 0) {
          result.delete(result.value.path);
        }
        result.continue();
      } else {
        cb();
      }
    };
    cursor.onerror = (ev) => {
      cb(errorFromEvent(ev));
    };
  }
}

class WebFileStoreDB {
  indexedDB: IDBDatabase;
  fsTableName = 'fs';
  dbKeys = ['path', 'dir1', 'dir2', 'dir3'];

  constructor() {
  }

  async init(dbName = 'db', clearDB = false) {
    const request = window.indexedDB.open(dbName, 1);
    if (!request) {
      throw new Error('indexedDB failed to open');
    }

    const promise = new ResolvablePromise<void>();

    request.onerror = (ev) => {
      const error = errorFromEvent(ev);
      console.error('indexedDB.request.onerror', {db: dbName, error});
      promise.reject(error);
    };

    request.onsuccess = (ev) => {
      this.indexedDB = (ev.target as IDBOpenDBRequest).result;
      this.indexedDB.onerror = (ev2) => {
        const error = errorFromEvent(ev2);
        console.error('indexedDB.onerror', {db: dbName, error});
      };
      this.indexedDB.onversionchange = () => {
        this.indexedDB.close();
        // TODO notify need for page refresh
        // Navigation.hardPageRefresh();
      };
      if (clearDB) {
        this.createTable(true);
      }
      promise.resolve();
    };

    request.onupgradeneeded = (ev) => {
      this.indexedDB = (ev.target as IDBOpenDBRequest).result;
      this.createTable(clearDB || Boolean(ev.oldVersion && ev.oldVersion !== ev.newVersion));
      clearDB = false;
    };
  }

  private createTable(deleteTable: boolean) {
    if (deleteTable) {
      try {
        this.indexedDB.deleteObjectStore(this.fsTableName);
      } catch (e) {
        // ignore
      }
    }

    try {
      const store = this.indexedDB.createObjectStore(this.fsTableName, {keyPath: this.dbKeys[0]});
      for (let i = 1; i < this.dbKeys.length; i++) {
        store.createIndex('d' + i, this.dbKeys.slice(1, i + 1), { unique: false });
      }
    } catch (e) {
      // ignore
    }
  }

  transact = async <T>(type: 'readonly' | 'readwrite', func: TransactionFunc<T>): Promise<T> => {
    const promise = new ResolvablePromise<T>();
    let error: ErrorType | undefined;
    let result: T | undefined;

    const transaction = this.indexedDB.transaction(this.fsTableName, type);
    transaction.onerror = (ev) => {
      promise.reject(errorFromEvent(ev));
    };
    transaction.onabort = function(ev) {
      promise.reject(errorFromEvent(ev));
    };
    transaction.oncomplete = function(_evIgnored) {
      promise.settle(error, result);
    };

    const store = transaction.objectStore(this.fsTableName);
    func(new FileStoreTransaction(store), (err, data) => {
      error = err;
      result = data;
    });

    return await promise.promise;
  };
}

export class WebFileStore implements IFileStore {
  private fileStoreDB = new WebFileStoreDB();
  private executor: SerialExecutor;
  private localHandlers: Stash<LocalMessageHandler> = {};
  private localStorageFailed = false;

  constructor() {
    this.executor = new SerialExecutor();
    window.addEventListener('storage', this.localReceive);
  }

  async init(dbName, clearDB) {
    await this.fileStoreDB.init(dbName, clearDB);
  }

  registerLocalMessageHandler(msg: string, handler: LocalMessageHandler) {
    this.localHandlers[msg] = handler;
  }

  localBroadcast(cmd: string, obj: any) {
    if (this.localStorageFailed) {
      return; // gets in the way of breakpointing exceptions
    }
    try {
      localStorage.setItem('message', JsonUtils.safeStringify([cmd, obj]));
      localStorage.removeItem('message');
    } catch (e) {
      this.localStorageFailed = true;
    }
  }

  private localReceive = (ev: StorageEvent) => {
    if (ev.key === 'message' && ev.newValue) {
      const message = JsonUtils.safeParse(ev.newValue);
      if (!message || message.length !== 2) {
        return;
      }
      const cmd: string = message[0];
      const obj: any = message[1];
      if (this.localHandlers[cmd]) {
        try {
          this.localHandlers[cmd](cmd, obj);
        } catch (e) {
        }
      }
    }
  };

  async transact<T>(type: 'readonly' | 'readwrite', func: TransactionFunc<T>): Promise<T> {
    return await this.executor.run(this.fileStoreDB.transact, type, func);
  }

  isInMutex() {
    return this.executor.isBusy();
  }

  async flushWrites() {
    await this.find('');
  }

  async find<T>(path: string): Promise<T|undefined> {
    return await this.transact<T|undefined>('readonly', (tx, cb) => {
      tx.find<T>(path, cb);
    });
  }

  async findDir<T>(path: string): Promise<FindDirData<T>> {
    return await this.transact<FindDirData<T>>('readonly', (tx, cb) => {
      tx.findDir<T>(path, cb);
    });
  }

  async update(path: string, obj: any) {
    await this.transact('readwrite', (tx, cb) => {
      tx.updateObj(path, obj, cb);
    });
  }

  async updateRaw(path: string, objStr: string) {
    await this.transact('readwrite', (tx, cb) => {
      tx.updateRaw(path, objStr, cb);
    });
  }

  async remove(path: string) {
    await this.transact('readwrite', (tx, cb) => {
      tx.remove(path, cb);
    });
  }

  async removeList(paths: string[]) {
    await this.transact('readwrite', (tx, cb) => {
      tx.removeList(paths, cb);
    });
  }

  async removeDir(path: string) {
    await this.transact('readwrite', (tx, cb) => {
      tx.removeDir(path, cb);
    });
  }

  async removeAllExcept(exceptPaths: string[]) {
    await this.transact('readwrite', (tx, cb) => {
      tx.removeAllExcept(exceptPaths, cb);
    });
  }

  async windowReadAll(): Promise<Stash> {
    // noop on web, this is meant for multi-window desktop apps
    return {};
  }

  async windowWrite(_key: string, _data: any) {
    // noop on web, this is meant for multi-window desktop apps
  }
}
