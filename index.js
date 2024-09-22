const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const nodemailer = require('nodemailer')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 8000
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const corsOptions = {
    origin: [
      'http://localhost:5173', 
      'http://localhost:5174',
      'https://brainstrom-d72ae.web.app',
      "brainstrom-d72ae.firebaseapp.com"

    ],
    credentials: true,
    optionSuccessStatus: 200,
  }
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
  };

  app.use(cors(corsOptions)) 
  app.use(express.json())
  app.use(cookieParser())

 

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token
    // console.log(token)
    if (!token) {
      return res.status(401).send({ message: 'unauthorized access 39', })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        console.log(err)
        return res.status(401).send({ message: 'unauthorized access 44' })
      }
      req.user = decoded
      next()
    })
  }

  

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zumttn0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    const db = client.db('brainstrom')
    const usersCollection = db.collection('users')
    const contestsCollection = db.collection('contests')
    const registerCollection = db.collection('register')
    const submitCollection = db.collection('submit')
    const creatorsCollection = db.collection('bestCreators')

        // verify admin middleware
    const verifyAdmin = async (req, res, next) => {
      // console.log('hello')
      const user = req.user
      const query = { email: user?.email }
      const result = await usersCollection.findOne(query)
      // console.log(result?.role)
      if (!result || result?.role !== 'Admin')
        return res.status(401).send({ message: 'unauthorized access!!' })

      next()
    }
       
        // verify Contest Creato middleware
        const verifyContestCreator = async (req, res, next) => {
        
          const user = req.user
          const query = { email: user?.email }
          const result = await usersCollection.findOne(query)
          console.log(result?.role)
          if (!result || result?.role !== 'ContestCreator') {
            return res.status(401).send({ message: 'unauthorized access!!' })
          }
    
          next()
        }
    // auth related api
   // jwt generate
   app.post('/jwt', async (req, res) => {
    const email = req.body
    const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: '365d',
    })
    res
      .cookie('token', token,  {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      })
      .send({ success: true })
  })

        // clere cookis
    app.post('/logout', async (req, res) => {
      const user = req.body;
      console.log('logging out', user);
      res.clearCookie('token', {...cookieOptions,  maxAge: 0 }).send({ success: true })
  })

       // get all Contest for Creator Contest
    app.get(
      '/MyCreatedContest/:email', verifyToken,   verifyContestCreator ,  
      async (req, res) => {
        const email = req.params.email

        let query = { 'contentCreator.email': email }
        const result = await contestsCollection.find(query).toArray()
        res.send(result)
      }
    )
//  get Best Creators
app.get('/best-creators',   async (req, res) => {
  const result = await creatorsCollection.find().toArray()
  res.send(result)
})

      //  Contest count
      app.get('/ContestCount', async (req, res) => {
        const count = await contestsCollection.countDocuments();
        // console.log(count, "this is count")
        res.send({ count });
      })
      // app.get('/Count', async (req, res) => {
      //   const count = await contestsCollection.countDocuments();
      //   console.log(count, "this is count")
      //   res.send({ count });
      // })
       // get all users data from db
       app.get('/users', verifyToken, verifyAdmin,  async (req, res) => {
        const result = await usersCollection.find().toArray()
        res.send(result)
      })
       app.get('/user/:email', verifyToken,  async (req, res) => {
        const email = req.params.email;
        
        const result = await usersCollection.findOne({email})
        res.send(result)
      })
      // get all contest  data from db for admin
       app.get('/all-contests', verifyToken, verifyAdmin,  async (req, res) => {         
        const result = await contestsCollection.find().toArray()
        res.send(result)
      })
      // get  contest of user by search
      app.get('/contest', async( req, res)=>{
        const search = req.query.search;
        const query = {
          status:'Confirm',
          category:{$regex:String(search), $options: 'i'},
        }
        const result = await contestsCollection.find(query).sort({ 
          participationCount: -1 }).toArray()
        // console.log(result ,"onley confrome contesr")
        res.send(result)
      })
      // get all contests
      app.get('/all-contests/user', async (req, res)=>{
        const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
        const result = await contestsCollection.find({status:'Confirm',}).skip(page * size)
        .limit(size)
        .toArray();
        res.send(result)
        // console.log(result)
      })
      app.get('/detail/contest/:id', verifyToken, async( req, res)=>{
        const id = req.params.id
        const query = {_id: new ObjectId(id)};
        const result = await contestsCollection.findOne(query)
        // console.log(result ,"onley confrome contesr")
        res.send(result)
      })
      // get payment contest data for user
      app.get('/payment-contest/:email', verifyToken, async (req, res)=>{
        const email = req.params.email;
        const query = {
          'participate.email': email
        }
        // console.log(query)
        const result = await registerCollection.find(query).sort({ to: 1 }).toArray()
        res.send(result);
      })
      // get all participant Contests  data for creator
      app.get('/participantContests/:email', verifyToken, verifyContestCreator, async (req, res)=>{
        const email = req.params.email;
        const query = {
          'contentCreator.email': email
        }
        // console.log(query)
        const result = await registerCollection.find(query).toArray()
        res.send(result);
      })
      // get my Winning contest
      app.get('/my-Winning-Contest/:email', verifyToken, async (req, res)=>{
        const email = req.params.email;
        const query = {
          'winerData.winerEmal': email
        }
        // console.log(query)
        const result = await registerCollection.find(query).toArray()
        res.send(result);
      })

      // get user user-stat
      app.get('/user-stat/:email', verifyToken, async (req, res)=>{
        const email = req.params.email;
      
        // console.log(query)
        const winningResult = await registerCollection.find({
          'winerData.winerEmal': email
        }).toArray()
        const participateResult = await registerCollection.find({
          'participate.email': email
        }).toArray()
        res.send({winningResult, participateResult});
      })
      //  get /DeclareContest data
      app.get('/declareContest', verifyToken, verifyContestCreator, async(req, res)=>{
        const email = req.query.email;
        const contestID = req.query.contestID
        // console.log(email, contestID, "/DeclareContest")
        const query = {
          
          contestId:contestID
        }
        const submitResult = await submitCollection.find({
          contest_id:contestID}).toArray();
        const registerResult = await registerCollection.find(query).toArray()
        // console.log(submitResult)
        res.send({submitResult, registerResult})

      })
      // get OURE latest winner
      app.get('/latest-winner', async (req, res) => {
        try {
          const result = await registerCollection
            .find() // Use find() instead of findOne()
            .sort({ 'winerData.winDate': -1 }) // Sort by winDate in descending order
            .limit(1) // Limit to 1 result
            .toArray(); // Convert cursor to an array to fetch the document
      
          if (result.length > 0) {
            res.json(result[0]); // Send the first document from the result array
          } else {
            res.status(404).json({ message: 'No winners found' });
          }
        } catch (error) {
          console.error('Error fetching latest winner:', error);
          res.status(500).json({ message: 'Internal server error' });
        }
      });
      

      // get data for leader bord
      app.get('/leaderboard', verifyToken, async (req, res) => {
        const result = await registerCollection.find().toArray()
        res.send(result);
      })
      //update a user role
    app.put('/users/update/:email', verifyToken, async (req, res) => {
      const email = req.params.email
      const data = req.body
      const query = { email }
      // console.log(data)
      const updateDoc = {
        $set: { ...data, timestamp: Date.now() },
      }
      const result = await usersCollection.updateOne(query, updateDoc)
      res.send(result)
      // console.log(result)
    })

       // save a user data in db
    app.put('/user',  async (req, res) => {
        const user = req.body
  
        const query = { email: user?.email }
        // check if user already exists in db
        const isExist = await usersCollection.findOne(query)
        if (isExist) {
          if (user.status === 'Requested') {
            // if existing user try to change his role
            const result = await usersCollection.updateOne(query, {
              $set: { status: user?.status },
            })
            return res.send(result)
          } else {
            // if existing user login again
            return res.send(isExist)
          }
        }
        // save user for the first time
        const options = { upsert: true }
        const updateDoc = {
          $set: {
            ...user,
            timestamp: Date.now(),
          },
        }
        const result = await usersCollection.updateOne(query, updateDoc, options)
        
        res.send(result)
      })

      // update contest 
      app.put('/contest/update/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id
        const data = req.body
        const query = { _id: new ObjectId(id) }
        // console.log(data)
        const option = {upsert:true}
        const updateDoc = {
          $set: { ...data, timestamp: Date.now() },
        }
        const result = await contestsCollection.updateOne(query, updateDoc, option)
        res.send(result)
        // console.log(result)
      })
      // submit pages id by user
      app.put('/submitpage', verifyToken,  async (req, res) => {
        const id = req.query.id
        const email = req.query.email
        const data = req.body
        const query = { contest_id: id,
          'participant_info.email': email
         }
        // console.log(data)
        // console.log(id, email)
        const isExist = await submitCollection.findOne(query)
       
        if (isExist) {
          // console.log("this moto return hoiche")
          const result = await submitCollection.updateOne(query, {
            $set:{submit: data.contest_paper}
          })
          res.send(result)
          return
          
        }
        const querySubmitPaper = { 
          contestId: id,
          'participate.email': email
         }
         const updateSubmitStatus = await registerCollection.updateOne(querySubmitPaper,{
          $set:{submitStatus:true}
        })
        const options = { upsert: true }
        const updateDoc = { ...data, submitTime: Date.now() }
        const result = await submitCollection.insertOne( updateDoc, options)
        res.send(result)
        // console.log(result)
      })
      // update Contest creator
      app.put('/update-contest/creator/:id', verifyToken, verifyContestCreator, async (req, res) => {
        const id = req.params.id
        const data = req.body
        const query = { _id: new ObjectId(id) }
        // console.log(data)
        const updateDoc = {
          $set: { ...data},
        }
        const result = await contestsCollection.updateOne(query, updateDoc)
        res.send(result)
        // console.log(result)
      })
      //  update participation count
      app.put('/update-participation/:id', verifyToken, async (req, res) => {
        const id = req.params.id
        const data = req.body
        const query = { _id: new ObjectId(id) }
        // console.log(data, id)
        const updateDoc = {
          $set: { ...data},
        }
        const result = await contestsCollection.updateOne(query, updateDoc)
        res.send(result)
        // console.log(result)
      })

      // save a registion data in db
      app.put('/register', verifyToken, async(req, res)=>{
        const data = req.body
        const email = req.query.email
        const id = req.query.contestId
        // console.log(email, contestId)
        const query = { contestId: id,
          'participate.email': email
          }
       
        const queryEmail = {'participate.email': email}
        const isExist= await registerCollection.findOne(query)
        // const isExistEmail = await registerCollection.findOne(queryEmail)

        if (isExist ) {
          res.send({status: true, })
          console.log("ei user already payment korche")
          return
        }
        const result = await registerCollection.insertOne(data);
        res.send(result)
        // console.log(result, "register result")
      })
      //  decler winner of the contest register colection
      app.put('/update-contest-register/creator/:id', verifyToken, verifyContestCreator, async (req, res) => {
        const id = req.params.id
        const data = req.body
        const query = { 
          contestId: id}
        // console.log(data)
        const updateDoc = {
          $set: { ...data},
        }
        const result = await registerCollection.updateMany(query, updateDoc)
        res.send(result)
        // console.log(result)
      })


           // Save a contest data in db
    app.post('/contest', verifyToken, verifyContestCreator, async (req, res) => {
      const contestData = req.body
      const result = await contestsCollection.insertOne(contestData)
      res.send(result)
    })

      // create-payment-intent
      app.post('/create-payment-intent', verifyToken, async (req, res) => {
        const price = req.body.price
        const priceInCent = parseFloat(price) * 100
        if (!price || priceInCent < 1 && priceInCent < 10000) {
          res.send({moreAmount:"Amount must be no more than 1000"})
          return}
        // generate clientSecret
        const { client_secret } = await stripe.paymentIntents.create({
          amount: priceInCent,
          currency: 'usd',
          // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
          automatic_payment_methods: {
            enabled: true,
          },
        })
        // send client secret as response
        res.send({ clientSecret: client_secret })
      })

      

      // delete a User
      app.delete('/delete/user/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const result = await usersCollection.deleteOne(query)
        res.send(result)
      })
      // delete contest by admin
      app.delete('/delete/contest/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const result = await contestsCollection.deleteOne(query)
        res.send(result)
      })
      // delete contest creator
      app.delete('/delete-creator-contest/:id', verifyToken, verifyContestCreator, async (req, res) => {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const result = await contestsCollection.deleteOne(query)
        res.send(result)
      })

    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!", );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
app.get('/', (req, res) => {
    res.send('Hello from Brainstrom Server..')
  })
  
app.listen(port, () => {
    console.log(`Brainstrom is running on port ${port}`)
  })