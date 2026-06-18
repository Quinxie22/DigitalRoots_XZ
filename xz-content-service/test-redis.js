const Redis = require('ioredis');

console.log('Testing localhost on 6380...');
const redisLocalhost = new Redis({
  host: 'localhost',
  port: 6380,
  connectTimeout: 2000
});

redisLocalhost.on('connect', () => {
  console.log('Connected to localhost:6380 successfully!');
  redisLocalhost.disconnect();
});

redisLocalhost.on('error', (err) => {
  console.error('Localhost error:', err);
  redisLocalhost.disconnect();
  
  console.log('Testing 127.0.0.1 on 6380...');
  const redisIP = new Redis({
    host: '127.0.0.1',
    port: 6380,
    connectTimeout: 2000
  });
  
  redisIP.on('connect', () => {
    console.log('Connected to 127.0.0.1:6380 successfully!');
    redisIP.disconnect();
  });
  
  redisIP.on('error', (err2) => {
    console.error('127.0.0.1 error:', err2);
    redisIP.disconnect();
  });
});
