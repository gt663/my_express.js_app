const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser'); // For parsing JSON request bodies
const propertiesReader = require('properties-reader');
const fs = require('fs'); // For file existence check

// Initialize app
const app = express();
app.use(cors());
app.use(bodyParser.json()); // Enable parsing of JSON request bodies

// Logger middleware function
const logger = (req, res, next) => {
    const method = req.method;  // GET, POST, etc.
    const url = req.originalUrl;  // The requested URL
    const timestamp = new Date().toISOString();  // Current timestamp
    console.log(`[${timestamp}] ${method} request to ${url}`);
    next();  // Pass control to the next middleware or route handler
};

// Apply the logger middleware globally
app.use(logger);

// Serve static files from the 'public/images' directory
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// Optional: Add custom error handling for missing image files
app.use((req, res, next) => {
    const imagePath = path.join(__dirname, 'public/images', req.url);
    if (req.url.startsWith('/images') && !fs.existsSync(imagePath)) {
        return res.status(404).json({ error: 'Image not found' });
    }
    next();
});

// Load MongoDB connection info from config.properties file
const properties = propertiesReader('config.properties');
const mongodbUser = properties.get('MONGODB_USER');
const mongodbPassword = properties.get('MONGODB_PASSWORD');
const mongodbClusterUrl = properties.get('MONGODB_CLUSTER_URL');
const mongodbDb = properties.get('MONGODB_DB');

// MongoDB URI from properties file
const uri = `mongodb+srv://${mongodbUser}:${mongodbPassword}@${mongodbClusterUrl}/${mongodbDb}?retryWrites=true&w=majority`;

// MongoDB setup
const { MongoClient } = require('mongodb');
const client = new MongoClient(uri);

let db;
client.connect().then(() => {
    db = client.db('lessons_booking');
    console.log('Connected to MongoDB Atlas');
});

// Endpoint to fetch lessons
app.get('/api/lessons_info', async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({ error: 'Database not connected' });
        }
        const lessons = db.collection('lessons_info');
        const results = await lessons.find({}).toArray();
        res.json(results);
    } catch (err) {
        console.error('Error fetching lessons:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Endpoint to save orders
app.post('/api/orders', async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({ error: 'Database not connected' });
        }
        const orderInfo = db.collection('order_info');
        const { name, phone, lessons } = req.body;

        // Save the order to the database
        await orderInfo.insertOne({ name, phone, lessons });

        res.status(201).json({ message: 'Order placed successfully' });
    } catch (err) {
        console.error('Error saving order:', err);
        res.status(500).json({ error: 'Failed to place order' });
    }
});

// Endpoint to update lesson availability
app.put('/api/update_lesson', async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({ error: 'Database not connected' });
        }

        const { subject, avail } = req.body;
        const lessons = db.collection('lessons_info');

        // Update the lesson availability based on the subject
        const result = await lessons.updateOne(
            { subject: subject }, // Find the lesson by subject
            { $set: { avail: avail } } // Set the new availability
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: 'Lesson not found or availability not updated' });
        }

        res.status(200).json({ message: 'Lesson availability updated' });
    } catch (err) {
        console.error('Error updating lesson availability:', err);
        res.status(500).json({ error: 'Failed to update lesson availability' });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
