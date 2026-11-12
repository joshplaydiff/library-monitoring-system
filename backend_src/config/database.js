require('dotenv').config();
const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'library_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  typeCast: function (field, next) {
    if (field.type === 'TINY' && field.length === 1) {
      const val = field.string();
      return val === '1';
    }
    return next();
  }
});

const promisePool = pool.promise();

pool.on('acquire', (connection) => {
  console.log('Database connection acquired');
});

pool.on('enqueue', () => {
  console.log('Waiting for available connection slot');
});

pool.on('connection', (connection) => {
  console.log('New database connection established');
});

module.exports = {
  pool,
  promisePool
};