const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;

// MiddleWares
app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hfh6rjb.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const apartmentsCollection = client.db('dwellife').collection('apartments');
    const usersCollection = client.db('dwellife').collection('users');
    const agreementsCollection = client.db('dwellife').collection('agreements');
    // JWT Token
    app.post('/jwt', async (req, res) => {
      const user = await req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'});
      res.send({token});
    });

    // Custom middlewares

    // Verify JWT Token 

    const verifyToken = async (req, res, next) => {
      if(!req.headers.authorization) {
        return res.status(401).send({message: 'UnAuthorized Access'});
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if(err) {
          return res.status(401).send({message: 'Forbidden Access'});
        }
        req.decoded = decoded;
        next();
      })
    };

    // Get All apartments data
    app.get('/api/apartments', async (req, res) => {
      const pageQuery = req.query.page;
      const size = 6;
      const startIndex = (pageQuery - 1) * size;
      const result = await Promise.all([apartmentsCollection.estimatedDocumentCount(), apartmentsCollection.find().skip(startIndex).limit(size).toArray()]);
      res.json({
        total: result[0],
        apartments: result[1],
      });
    });
    // save users in Database
    app.post('/api/users', async (req, res) => {
      const user = req.body;
      const query = { email : user.email};
      const isExist = await usersCollection.findOne(query);
      if(!isExist){
        const result = await usersCollection.insertOne(user);
        res.send(result);
      } else{
        res.send({ message: 'User Already Exists', InsertedId: null});
      }
    });

    app.post('/api/agreement', verifyToken , async (req, res) => {
      const agreementInfo = req.body;
      const result = await agreementsCollection.insertOne(agreementInfo);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log('Pinged your deployment. You successfully connected to MongoDB!');
  } finally {
  }
}

run().catch(console.dir);

app.get('/api', (req, res) => {
  res.send('Hello World!');
});
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
