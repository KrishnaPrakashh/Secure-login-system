const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./database.db", (err) => {

  if (err) {

    console.log(err.message);

  } else {

    console.log("Database connected");

  }

});

db.serialize(() => {

  db.run(`

  CREATE TABLE IF NOT EXISTS users(

  id INTEGER PRIMARY KEY AUTOINCREMENT,

  name TEXT NOT NULL,

  email TEXT UNIQUE NOT NULL,

  password TEXT NOT NULL

  )

  `);

});

module.exports = db;