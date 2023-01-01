/**
 * Copyright 2015-present Ampersand Technologies, Inc.
 */
import { ErrDataCB, Stash } from 'amper-utils/dist/types';
import { FindDirData, IFileStore } from 'data-store/dist/dataStorePersist';
export type TransactionFunc<T> = (transaction: FileStoreTransaction, cb: ErrDataCB<T>) => void;
export type LocalMessageHandler = (cmd: string, obj: any) => void;
export declare function encodeKeyToFilename(dbkey: string): string;
export declare function decodeKeyFromFilename(fsKey: string): string;
export declare function encodeKeysToFilenames(dbKeys: string[]): any[];
export declare class FileStoreTransaction {
    private readonly store;
    constructor(store: IDBObjectStore);
    find<T>(path: string, cb: ErrDataCB<T | undefined>): void;
    findDir<T>(path: string, cb: ErrDataCB<FindDirData<T>>): void;
    updateRaw(path: string, objStr: string, cb: ErrDataCB<void>): void;
    updateObj(path: string, obj: any, cb: ErrDataCB<void>): void;
    remove(path: string, cb: ErrDataCB<void>): void;
    removeList(paths: string[], cb: ErrDataCB<void>): void;
    removeDir(path: string, cb: ErrDataCB<void>): void;
    removeAllExcept(exceptPaths: string[], cb: ErrDataCB<void>): void;
}
export declare class WebFileStore implements IFileStore {
    private fileStoreDB;
    private executor;
    private localHandlers;
    private localStorageFailed;
    constructor();
    init(dbName: any, clearDB: any): Promise<void>;
    registerLocalMessageHandler(msg: string, handler: LocalMessageHandler): void;
    localBroadcast(cmd: string, obj: any): void;
    private localReceive;
    transact<T>(type: 'readonly' | 'readwrite', func: TransactionFunc<T>): Promise<T>;
    isInMutex(): boolean;
    flushWrites(): Promise<void>;
    find<T>(path: string): Promise<T | undefined>;
    findDir<T>(path: string): Promise<FindDirData<T>>;
    update(path: string, obj: any): Promise<void>;
    updateRaw(path: string, objStr: string): Promise<void>;
    remove(path: string): Promise<void>;
    removeList(paths: string[]): Promise<void>;
    removeDir(path: string): Promise<void>;
    removeAllExcept(exceptPaths: string[]): Promise<void>;
    windowReadAll(): Promise<Stash>;
    windowWrite(_key: string, _data: any): Promise<void>;
}
