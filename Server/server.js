const express = require('express');
require('dotenv').config();
const cors = require('cors');
const connectDB = require('./config');
const apiRoutes = require('./routes/api');
const expressRateLimit = require('express-rate-limit');

const app = express();

const limit = expressRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 60, // limit each IP to 60 requests per windowMs
    message: "Too many requests form this IP, Please try again after 15 minutes!"
});

app.use(limit);

// Middlewares
app.use(cors());
app.use(express.json());

// Connect Database
connectDB();

// Routes
app.use('/api', apiRoutes);

app.listen(4500, () => {
    console.log(`Server running at http://localhost:4500`);
});
