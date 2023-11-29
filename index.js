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
    const announcementsCollection = client.db('dwellife').collection('announcements');
    const couponsCollection = client.db('dwellife').collection('coupons');
    // JWT Token
    app.post('/jwt', async (req, res) => {
      const user = await req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    });

    // Custom middlewares

    // Verify JWT Token

    const verifyToken = async (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'UnAuthorized Access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'Forbidden Access' });
        }
        req.decoded = decoded;
        next();
      });
    };

    // Verify Admin

    const verifyAdmin = async (req, res, next) => {
      const email = await req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ message: 'Forbidden Access' });
      }

      next();
    };

    // Verify Member

    const verifyMember = async (req, res, next) => {
      const email = await req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'member') {
        return res.status(403).send({ message: 'Forbidden Access' });
      }

      next();
    };

    // Check if the usr is admin or not

    app.get('/api/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user.role === 'admin';
      }
      return res.send({ admin });
    });

    // Check if the usr is member or not

    app.get('/api/users/member/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let member = false;
      if (user) {
        member = user.role === 'member';
      }
      return res.send({ member });
    });

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

    // Get All Announcements data

    app.get('/api/announcements', verifyToken, async (req, res) => {
      const result = await announcementsCollection.find().toArray();
      res.send(result);
    });

    // Get All agreements data

    app.get('/api/agreements', verifyToken, verifyAdmin, async (req, res) => {
      const result = await agreementsCollection.find().toArray();
      res.send(result);
    });

    // Get All Coupons data
    app.get('/api/coupons', verifyToken, async (req, res) => {
      const result = await couponsCollection.find().toArray();
      res.send(result);
    });

    app.get('/api/available-coupons', async (req, res) => {
      const query = { available: true };
      const result = await couponsCollection.find(query).toArray();
      res.send(result);
    });


    //Get users in Database

    app.get('/api/users', verifyToken, verifyAdmin, async (req, res) => {
      const role = req.query.role;
      const query = { role: role };
      const result = await usersCollection.find(query).toArray();
      return res.send(result);
    });

    // save users in Database
    app.post('/api/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const isExist = await usersCollection.findOne(query);
      if (!isExist) {
        const result = await usersCollection.insertOne(user);
        res.send(result);
      } else {
        res.send({ message: 'User Already Exists', InsertedId: null });
      }
    });

    // save agreements in Database
    app.post('/api/agreement', verifyToken, async (req, res) => {
      const agreementInfo = req.body;
      const result = await agreementsCollection.insertOne(agreementInfo);
      res.send(result);
    });

    //save announcements in Database

    app.post('/api/announcements', verifyToken, verifyAdmin, async (req, res) => {
      const announcementInfo = req.body;
      const result = await announcementsCollection.insertOne(announcementInfo);
      res.send(result);
    });

    //save coupons in Database

    app.post('/api/coupons', verifyToken, verifyAdmin, async (req, res) => {
      const couponInfo = req.body;
      const result = await couponsCollection.insertOne(couponInfo);
      res.send(result);
    });

    // Delete Coupon

    app.delete('/api/coupons/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await couponsCollection.deleteOne(query);
      res.send(result);
    });

    // update coupon availability;

    app.patch('/api/coupons/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const available = req.body.available;
      const query = { _id : new ObjectId(id)};
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          available: available,
        }
      };
      const result = await couponsCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // update Agreement status

    app.patch('/api/agreements/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      const query = { _id : new ObjectId(id)};
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          status: status,
        }
      };
      const result = await agreementsCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // update user role

    app.patch('/api/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.id;
      const role = req.body.role;
      const query = {email : email};
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          role: role,
        }
      }
      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send(result);
    
    });

    // remove members and update users

    app.patch('/api/remove-member', verifyToken, verifyAdmin, async (req, res) => {
      const email = req.body.email;
      console.log(email);
      const filter = { email: email };
      const updateDoc = {
        $set: {
          role: 'user',
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
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
