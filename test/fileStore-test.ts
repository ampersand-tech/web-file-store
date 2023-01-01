/**
* Copyright 2018-present Ampersand Technologies, Inc.
*/

import * as FileStore from '../lib/index';

import * as ObjUtils from 'amper-utils/dist/objUtils';
import { expect } from 'chai';
import { describe, it } from 'mocha';

describe('key encoding functions', function() {
  let encodingMap = {
    'oneTwo3Four': 'one^Two3^Four',
    'ft4+1s3_10': 'ft4+1s3_10',
    'tableSubs:dashboards': 'table^Subs^+dashboards',
    'Abc^De': '^Abc^De',
  };
  let decodingMap = {
    'one^Two3^Four': 'oneTwo3Four',
    'ft4+1s3_10': 'ft4+1s3_10',
    'table^Subs^+dashboards': 'tableSubs:dashboards',
    '^Abc^De': 'AbcDe', // note: NOT symmetric, intentionally
  };
  it('encodeKeyToFilename should encode special characters', function() {
    for (let key in encodingMap) {
      expect(FileStore.encodeKeyToFilename(key)).to.equal(encodingMap[key]);
    }
  });
  it('decodeKeyFromFilename should decode special characters', function() {
    for (let key in decodingMap) {
      expect(FileStore.decodeKeyFromFilename(key)).to.equal(decodingMap[key]);
    }
  });
  it('encodeKeysToFilenames should encode special characters', function() {
    expect(FileStore.encodeKeysToFilenames(Object.keys(encodingMap))).to.deep.equal(ObjUtils.objectValues(encodingMap));
  });
});
