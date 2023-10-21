const pg = require('pg')

const db = new pg.Pool({
  connectionString: `postgres://rockps:rockps@localhost:5432/ParSir`
});

db.connect((err) => {
  if (err) throw err;
  console.log("\tINFO: База данных PostgreSQL подключена!");
});

module.exports = db;
