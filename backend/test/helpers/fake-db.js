function makeFakeDb(queryFn, queryOneFn) {
  const _queryOneFn =
    queryOneFn ??
    ((sql, params) =>
      Promise.resolve(queryFn(sql, params)).then((r) => (Array.isArray(r) ? (r[0] ?? null) : r)));
  return {
    query: queryFn,
    queryOne: _queryOneFn,
    transaction: async (fn) => {
      const fakeConn = {
        execute: async (sql, params) => {
          const result = await queryFn(sql, params);
          return [result];
        },
      };
      return fn(fakeConn);
    },
  };
}

module.exports = { makeFakeDb };
