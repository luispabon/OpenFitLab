function makeFakeDb(queryFn) {
  return {
    query: queryFn,
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

