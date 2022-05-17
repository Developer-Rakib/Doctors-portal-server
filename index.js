const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();


// middleware
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nbflg.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run (){
    try {
        await client.connect()
        const servicesCollection = client.db("DoctorsPortal").collection("services");
        const bookingCollection = client.db("DoctorsPortal").collection("booking");

        app.get("/services", async(req, res)=>{
            const query = {};
            const cursor = servicesCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })
        app.get("/booking", async(req, res)=>{
            const query = {};
            const cursor = bookingCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })

        app.get("/available", async(req, res)=>{
            const date = req.query.date;
            const services = await servicesCollection.find().toArray()
            const query = {date: date}
            const booking = await bookingCollection.find(query).toArray()
            services.forEach(service => {
                const servicesBooking = booking.filter(b => b.treatment === service.name)
                const bookedSlots = servicesBooking.map(book => book.slot)
                const available = service.slots.filter(slot => !bookedSlots.includes(slot))
                service.slots= available;
            })
            res.send(services)
        })

        app.post("/booking", async(req, res)=>{
            const booking = req.body;
            const query = {treatment: booking.treatment, date: booking.date, userName: booking.userName};
            const exist = await bookingCollection.findOne(query);
            console.log(exist);
            if (exist) {
                return res.send({success: false, message: booking})
            }
            const result = await bookingCollection.insertOne(booking)
            res.send({success: true, message: result})
        })

    } finally {
        
    }
}
run().catch(console.dir)


app.get("/", (req, res)=>{
    res.send("Welcom to Doctors Portal")
})
app.listen(port, ()=>{
    console.log("port is", port);
})