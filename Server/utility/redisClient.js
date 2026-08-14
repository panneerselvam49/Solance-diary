const { createClient } = require('redis');

const client = createClient();

client.on('error', err => console.error('Redis Client Error:', err));

client.connect()
    .then(() => {
        console.log("Redis connected successfully!");
    })
    .catch(err => {
        console.error("Error connecting to Redis:", err);
    });

module.exports = client;
