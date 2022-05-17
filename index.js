const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();


// middleware
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nbflg.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorize Access!' })
    }
    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.SECRET_ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'Farbidden Access!!' })
        }
        req.decoded = decoded;
        next()
    });

}

async function run() {
    try {
        await client.connect()
        const servicesCollection = client.db("DoctorsPortal").collection("services");
        const bookingCollection = client.db("DoctorsPortal").collection("booking");
        const userCollection = client.db("DoctorsPortal").collection("user");

        // get all user
        app.get("/user", verifyToken, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result)
        })

        // make admin
        app.put("/user/admin/:email", async (req, res) => {
            const email = req.params.email
            const filter = { email: email };
            const updateDoc = {
                $set: {roll : 'admin'}
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result)
        })

        // post user 
        app.put("/user/:email", async (req, res) => {
            const email = req.params.email
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.SECRET_ACCESS_TOKEN, { expiresIn: '30d' })
            res.send({ result, token })
        })


        //get user booking 
        app.get("/booking", verifyToken, async (req, res) => {
            const email = req.decoded.email;
            const userEmail = req.query.email;
            if (!email === userEmail) {
                return res.status(403).send({ message: 'Farbidden Access!!' })
            }
            else {
                const query = { userEmail: userEmail };
                const cursor = bookingCollection.find(query);
                const result = await cursor.toArray();
                res.send(result)
            }
        })
        // post booking 
        app.post("/booking", async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, userName: booking.userName };
            const exist = await bookingCollection.findOne(query);
            console.log(exist);
            if (exist) {
                return res.send({ success: false, message: booking })
            }
            const result = await bookingCollection.insertOne(booking)
            res.send({ success: true, message: result })
        })

        //get all service 
        app.get("/services", async (req, res) => {
            const query = {};
            const cursor = servicesCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })

        //get available service 
        app.get("/available", async (req, res) => {
            const date = req.query.date;
            const services = await servicesCollection.find().toArray()
            const query = { date: date }
            const booking = await bookingCollection.find(query).toArray()
            services.forEach(service => {
                const servicesBooking = booking.filter(b => b.treatment === service.name)
                const bookedSlots = servicesBooking.map(book => book.slot)
                const available = service.slots.filter(slot => !bookedSlots.includes(slot))
                service.slots = available;
            })
            res.send(services)
        })



    } finally {

    }
}
run().catch(console.dir)


app.get("/", (req, res) => {
    res.send("Welcom to Doctors Portal")
})
app.listen(port, () => {
    console.log("port is", port);
})