const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('---HTML START---');
    console.log(data.substring(0, 500));
    console.log('---HTML END---');
    process.exit(0);
  });
});

req.on('error', (error) => {
  console.error(`Problem with request: ${error.message}`);
  process.exit(1);
});

req.end();
