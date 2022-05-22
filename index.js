const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
        const doctorCollection = client.db("DoctorsPortal").collection("doctor");

        // verify admin
        const verifyAdmin = async(req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester })
            if (requesterAccount.roll === 'admin') {
                next()
            }
            else {
                res.status(403).send({ message: 'forbidden' })
            }
        }

        // get admin
        app.get("/admin/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            // console.log(user);
            const isAdmin = user?.roll === 'admin'
            res.send({ admin: isAdmin })
        })

        // make admin
        app.put("/user/admin/:email", verifyToken, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { roll: 'admin' }
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result)

        })

        // get Doctors
        app.get("/doctor", verifyToken, verifyAdmin, async (req, res) => {
            const result = await doctorCollection.find().toArray();
            res.send(result)
        })

        // post doctor
        app.post("/doctor", verifyToken, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const result = await doctorCollection.insertOne(doctor)
            if (result.insertedId) {
                res.send({ success: true, message: `Dr. ${doctor.name} Successfully Added` })
            }
            else {
                res.send({ success: false, message: 'Somting is Wrong, Please try Again' })
            }
        })

        // delete doctor 
        app.delete('/doctor/:email', async(req, res)=>{
            const email = req.params.email;
            const filter  = {email : email}
            const result = await doctorCollection.deleteOne(filter)
            res.send(result)
        })


        // get all user
        app.get("/user", verifyToken, async (req, res) => {
            const result = await userCollection.find().toArray();
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


        //get  booking 
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
            if (exist) {
                return res.send({ success: false, message: booking })
            }
            const result = await bookingCollection.insertOne(booking)
            res.send({ success: true, message: result })
        })

        //get all service 
        app.get("/booking/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = {_id:ObjectId(id)};
            const result = await bookingCollection.findOne(query)
            res.send(result)
        })

        //get all service 
        app.get("/services", async (req, res) => {
            const query = {};
            const cursor = servicesCollection.find(query).project({ name: 1 });
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