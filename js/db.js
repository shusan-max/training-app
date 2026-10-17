// データの保存を担当するファイル。
// ブラウザの中の保存場所(IndexedDB)を使う。画面のファイルからは、ここの関数だけを使う。

const DB_NAME = 'training-app';

// データの形の版番号。箱を足したり形を変えたりしたら1つ上げる。
export const DB_VERSION = 1;

// 保存する「箱」の一覧。
// keyPath は1件ずつを見分けるための項目、indexes はあとで探しやすくするための項目。
// 食事やAIの箱は、DB_VERSION を上げてここに足す。
const STORES = {
  settings: { keyPath: 'id' },                                     // 設定(1件だけ)
  bodyLogs: { keyPath: 'date' },                                   // 体の記録(1日1件)
  exercises: { keyPath: 'id' },                                    // 自分で足した種目
  workouts: { keyPath: 'id', indexes: ['date'] },                  // トレーニング(1回の練習ごと)
  sets: { keyPath: 'id', indexes: ['workoutId', 'exerciseId'] },   // セット
  plans: { keyPath: 'id', indexes: ['date'] },                     // メニュー提案の記録
};
export const STORE_NAMES = Object.keys(STORES);

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      // 初めて開いたときや、版番号が上がったときに箱を作る
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const [name, def] of Object.entries(STORES)) {
          if (db.objectStoreNames.contains(name)) continue;
          const store = db.createObjectStore(name, { keyPath: def.keyPath });
          for (const index of def.indexes ?? []) {
            store.createIndex(index, index);
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

// IndexedDB の「頼んだ処理が終わったら知らせる」仕組みを、await で待てる形にする
function requestDone(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// 1件読む
export async function get(storeName, key) {
  const db = await openDb();
  return requestDone(db.transaction(storeName).objectStore(storeName).get(key));
}

// 箱の中身を全部読む
export async function getAll(storeName) {
  const db = await openDb();
  return requestDone(db.transaction(storeName).objectStore(storeName).getAll());
}

// 探しやすくするための項目(indexes)で探す。例:あるトレーニングのセットを全部
export async function getAllByIndex(storeName, indexName, value) {
  const db = await openDb();
  return requestDone(db.transaction(storeName).objectStore(storeName).index(indexName).getAll(value));
}

// 1件保存する(同じ見分け番号があれば上書き)
export async function put(storeName, value) {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(value);
  await transactionDone(tx);
  return value;
}

// 1件消す
export async function remove(storeName, key) {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).delete(key);
  await transactionDone(tx);
}

// まとめて消す
export async function removeMany(storeName, keys) {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  keys.forEach((key) => store.delete(key));
  await transactionDone(tx);
}

// 全部の箱の中身をまとめて読む(バックアップ用)
export async function exportAll() {
  const db = await openDb();
  const tx = db.transaction(STORE_NAMES);
  const data = {};
  await Promise.all(STORE_NAMES.map(async (name) => {
    data[name] = await requestDone(tx.objectStore(name).getAll());
  }));
  return data;
}

// 全部の箱の中身を置き換える(バックアップから戻す用)
// 途中で失敗したときは、何も変わらない(全部成功か、全部取り消しのどちらか)
export async function importAll(data) {
  const db = await openDb();
  const tx = db.transaction(STORE_NAMES, 'readwrite');
  for (const name of STORE_NAMES) {
    const store = tx.objectStore(name);
    store.clear();
    for (const item of data[name] ?? []) {
      store.put(item);
    }
  }
  await transactionDone(tx);
}

// 新しい見分け番号を作る
export function newId() {
  return crypto.randomUUID();
}

// 「容量が足りなくなっても、このデータは消さないで」とブラウザにお願いする
export async function requestPersistentStorage() {
  try {
    return await navigator.storage?.persist?.();
  } catch {
    return false;
  }
}
