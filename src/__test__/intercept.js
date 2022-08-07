(async function main() {
    const https = require('https');
    console.log('Testing a request');

    const req = https.request('https://google.com', res => {
        console.log('response received:', res.statusMessage);
    })
    req.on('error', console.error);
    req.end();
})();