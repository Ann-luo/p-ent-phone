// Storage Layer — IndexedDB helpers (uses pent_db_v1)

function idbGet(key) {
  return idbOpen().then(function(db) {
    return new Promise(function(resolve) {
      var tx = db.transaction(IDB_STORE, 'readonly');
      var req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = function() { resolve(req.result ? req.result.value : undefined); };
      req.onerror = function() { resolve(undefined); };
    });
  });
}

function idbPut(key, value) {
  return idbOpen().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(IDB_STORE, 'readwrite');
      var req = tx.objectStore(IDB_STORE).put({ key: key, value: value });
      req.onsuccess = function() { resolve(); };
      req.onerror = function() { reject(req.error); };
    });
  });
}

function idbDelete(key) {
  return idbOpen().then(function(db) {
    return new Promise(function(resolve) {
      var tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = function() { resolve(); };
    });
  });
}
