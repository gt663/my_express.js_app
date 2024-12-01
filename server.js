const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser'); 
const propertiesReader = require('properties-reader');
const fs = require('fs'); 


// Allow requests from your GitHub Pages site
const corsOptions = {
    origin: 'https://gt663.github.io', // The domain you want to allow
    methods: ['GET', 'POST','PUT'], // Allow these HTTP methods
    credentials: true // If you need cookies or authorization headers
  };

// Initialize app
const app = express();
app.use(cors(corsOptions));
app.use(bodyParser.json()); 

// Logger middleware function
const logger = (req, res, next) => {
    const method = req.method;  
    const url = req.originalUrl; 
    const timestamp = new Date().toISOString(); 
    console.log(`[${timestamp}] ${method} request to ${url}`);
    next();  
};


app.use(logger);


app.use('/images', express.static(path.join(__dirname, 'public/images')));


app.use((req, res, next) => {
    const imagePath = path.join(__dirname, 'public/images', req.url);
    if (req.url.startsWith('/images') && !fs.existsSync(imagePath)) {
        return res.status(404).json({ error: 'Image not found' });
    }
    next();
});

// Load connection info from config.properties 
const properties = propertiesReader('config.properties');
const mongodbUser = properties.get('MONGODB_USER');
const mongodbPassword = properties.get('MONGODB_PASSWORD');
const mongodbClusterUrl = properties.get('MONGODB_CLUSTER_URL');
const mongodbDb = properties.get('MONGODB_DB');


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

        
        const result = await lessons.updateOne(
            { subject: subject }, 
            { $set: { avail: avail } } 
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


app.get('/api/search', async (req, res) => {
    const query = req.query.q;

    if (!query) {
        return res.status(400).json({ error: 'Search query cannot be empty' });
    }

    try {
        const lessonsCollection = db.collection('lessons_info');
        
    
        const allLessons = await lessonsCollection.find({}).toArray();

        // Filter lessons in JavaScript
        const filteredLessons = allLessons.filter(lesson =>
            (lesson.subject && lesson.subject.toLowerCase().includes(query.toLowerCase())) ||
            (lesson.location && lesson.location.toLowerCase().includes(query.toLowerCase())) ||
            (lesson.price && lesson.price.toString().includes(query)) ||
            (lesson.avail && lesson.avail.toString().includes(query))
        );

        
        res.json(filteredLessons);
    } catch (error) {
        console.error('Error during search:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port:${PORT}`);
});
