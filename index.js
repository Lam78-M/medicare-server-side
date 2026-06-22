const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

const uri = process.env.MONGO_DB_URI;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();

        const database = client.db("medicare_user");
        // Medicare data collections
        const doctorsCollection = database.collection("doctors");
        const appoinmentCollection = database.collection("appointments")
        const reviewsCollection = database.collection("reviews")

        //doctors review by patient 

          app.post("/api/v1/reviews", async (req, res) => {
  try {
    const reviewData = {
      ...req.body,
      createdAt: new Date() // Dynamic current date-time system active rakhar jonno
    };
    const result = await reviewsCollection.insertOne(reviewData);
    res.status(201).json({ 
      success: true, 
      message: "Review successfully saved in database! 🎉",
      insertedId: result.insertedId 
    });
  } catch (error) {
    console.error("Database Insert Error:", error);
    res.status(500).json({ success: false, message: "Server database crash!" });
  }
});

        // appoinments post

        app.post('/api/appointments', async (req, res) => {
    try {
        const appointmentCollection = database.collection("appointments");
        const bookingData = req.body;
        
        // collection data insert
        const result = await appointmentCollection.insertOne(bookingData);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

       // ২. get data from collection (get all data)
app.get('/api/appointments', async (req, res) => {
    try {
        const appointmentCollection = database.collection("appointments");
        
        // সব ডেটা খুঁজে অ্যারে বানিয়ে নেওয়া
        const appointments = await appointmentCollection.find({}).toArray();
        res.status(200).json(appointments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/appointments/patient', async (req, res) => {
    try {
        const appointmentCollection = database.collection("appointments");
        const query = { userEmail: req.query.email }; // ফ্রন্টএন্ড থেকে পাঠানো ইমেইল কুয়েরি
        
        // ইমেইল অনুযায়ী ডেটা খুঁজে অ্যারে বানানো
        const appointments = await appointmentCollection.find(query).toArray();
        res.status(200).json(appointments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/appointments/doctor', async (req, res) => {
    try {
        const { email } = req.query; 
        
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        console.log("Searching appointments for doctor email:", email);

        // 💡 এখানে তোমার ডিফাইন করা আসল ভেরিয়েবলের নাম 'appoinmentCollection' ব্যবহার করা হয়েছে
        const appointments = await appoinmentCollection.find({ doctorEmail: email }).toArray();
        
        console.log("Found doctor appointments count:", appointments.length);
        res.status(200).json(appointments);
    } catch (error) {
        console.error("Doctor Appointment Fetch Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});


// 🟢 অ্যাপয়েন্টমেন্ট স্ট্যাটাস 'Approved' করার জন্য PATCH API
app.patch('/api/appointments/approve/:id', async (req, res) => {
    try {
        const { ObjectId } = require('mongodb');
        const id = req.params.id;

        // আইডি ফরম্যাট ঠিক আছে কিনা চেক করা
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid Appointment ID format" });
        }

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
            $set: {
                status: 'Approved' // সরাসরি ডাটাবেজে স্ট্যাটাস Approved সেট হবে
            }
        };

        // 💡 তোমার ব্যাকএন্ডের আসল কালেকশন ভেরিয়েবল 'appoinmentCollection'
        const result = await appoinmentCollection.updateOne(filter, updateDoc);

        if (result.modifiedCount === 1 || result.matchedCount === 1) {
            res.status(200).json({ success: true, message: "Appointment approved successfully! 🎉" });
        } else {
            res.status(400).json({ success: false, message: "No data changed or appointment not found." });
        }
    } catch (error) {
        console.error("Approve API Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// appointment deleting ----------------

app.delete('/api/appointments/:id', async (req, res) => {
    try {
        const { ObjectId } = require('mongodb'); // MongoDB ObjectId tracking conversion
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid Appointment ID format" });
        }

        const appointmentCollection = database.collection("appointments");
        const query = { _id: new ObjectId(id) };

        const result = await appointmentCollection.deleteOne(query);

        if (result.deletedCount === 1) {
            res.status(200).json({ success: true, message: "Appointment canceled successfully! 🛑" });
        } else {
            res.status(404).json({ success: false, message: "No appointment found with this ID" });
        }
    } catch (error) {
        console.error("Cancel API Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// appointment rescheduleing ----

app.patch('/api/appointments/:id', async (req, res) => {
    try {
        const { ObjectId } = require('mongodb');
        const id = req.params.id;
        const { appointmentDate, appointmentDay, appointmentTime } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid Appointment ID format" });
        }

        const appointmentCollection = database.collection("appointments");
        const filter = { _id: new ObjectId(id) };

        // Database dynamically set processing matching data structure tracker
        const updateDoc = {
            $set: {
                appointmentDate: appointmentDate,
                appointmentDay: appointmentDay,
                appointmentTime: appointmentTime
            }
        };

        const result = await appointmentCollection.updateOne(filter, updateDoc);

        if (result.modifiedCount === 1 || result.matchedCount === 1) {
            res.status(200).json({ success: true, message: "Appointment rescheduled successfully! 🗓️✨" });
        } else {
            res.status(400).json({ success: false, message: "No data changed or invalid target metadata." });
        }
    } catch (error) {
        console.error("Reschedule API Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// doctor review filtering 

     // Backend Route: Current Patient-er kora appointments theke doctors list ana
// 🛠️ ৯. আপডেট করা রুট: ডাইনামিক ফিল্ড চেকিং সহ ইউনিক ডক্টর লিস্ট আনা
app.get("/api/v1/patient-appointments/:email", async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email parameter is required" });
    }

    // 💡 $or ব্যবহার করা হয়েছে যাতে ডাটাবেজে userEmail, email বা patientEmail যা-ই থাকুক না কেন ডেটা চলে আসে
    const appointments = await appoinmentCollection.find({
      $or: [
        { userEmail: email },
        { email: email },
        { patientEmail: email }
      ]
    }).toArray();

    console.log(`🔍 Total appointments found for ${email}:`, appointments.length);

    if (!appointments || appointments.length === 0) {
      return res.status(200).json({ success: true, doctors: [] });
    }

    // 🔥 UNIQUE DOCTORS FILTER: ডুপ্লিকেট বাদ দিয়ে ইউনিক ডক্টর ম্যাপ করা
    const uniqueDoctorsMap = {};
    appointments.forEach(appnt => {
      // ডাটাবেজে doctorId বা id বা _id যেকোনো নামে আইডি থাকতে পারে
      const docId = appnt.doctorId || appnt.id || appnt._id;
      const docName = appnt.doctorName || appnt.name;

      if (docId) {
        uniqueDoctorsMap[docId] = {
          id: docId,
          doctorId: docId, // ফ্রন্টএন্ড সেফটির জন্য দুটাই রাখা হলো
          name: docName || "Unknown Doctor",
          doctorName: docName || "Unknown Doctor",
          specialization: appnt.specialization || ""
        };
      }
    });

    const uniqueDoctorsList = Object.values(uniqueDoctorsMap);
    console.log("🎯 Formatted Unique Doctors List Sent to Frontend:", uniqueDoctorsList);

    res.status(200).json({
      success: true,
      doctors: uniqueDoctorsList
    });

  } catch (error) {
    console.error("Fetch Appointment Doctors Error:", error);
    res.status(500).json({ success: false, message: "Server API crash!", error: error.message });
  }
});



      // showind doctors that there patient give them ratings

app.get('/api/v1/reviews/doctor/:doctorId', async (req, res) => {
            try {
                const { doctorId } = req.params;
                const reviews = await reviewsCollection.find({ doctorId: doctorId }).toArray();
                res.status(200).json({ success: true, reviews });
            } catch (error) {
                res.status(500).json({ success: false, message: "Error fetching reviews" });
            }
        });
          
        // 🩺 Doctors API Route
        app.get('/api/doctors', async (req, res) => {
            try {
                const search = req.query.search;
                const specialization = req.query.specialization;
                const sort = req.query.sort;

                let query = {};

                if (search && search.trim() !== "") {
                    query.doctorName = { $regex: search, $options: 'i' };
                }

                if (specialization && specialization.trim() !== "") {
                    query.specialization = specialization;
                }

                let sortOption = {};
                if (sort === 'lowToHigh') {
                    sortOption.consultationFee = 1;  
                } else if (sort === 'highToLow') {
                    sortOption.consultationFee = -1; 
                } else {
                    sortOption._id = -1;       
                }
                // 💡 এখানে বানান ফিক্স করা হয়েছে: doctorsCollection ব্যবহার করা হয়েছে
                const result = await doctorsCollection.find(query).sort(sortOption).toArray();
                
                console.log("Found Doctors Count:", result.length);
                res.send(result);
            } catch (error) {
                console.error("Error fetching doctors:", error);
                res.status(500).send({ message: "Server Error", error: error.message });
            }
        });




        //sigle doctor id 
        app.get('/api/doctors/:id', async (req, res) => {
            try {
                const { ObjectId } = require('mongodb'); // মঙ্গোডিবির অবজেক্ট আইডি কনভার্টার
                const id = req.params.id;
                // আইডি চেক করা (ভুল আইডি দিলে যাতে ক্র্যাশ না করে)
                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({ message: "Invalid Doctor ID format" });
                }

                const query = { _id: new ObjectId(id) };
                const result = await doctorsCollection.findOne(query);

                if (!result) {
                    return res.status(404).send({ message: "Doctor not found" });
                }

                res.send(result);
            } catch (error) {
                console.error("Error fetching single doctor:", error);
                res.status(500).send({ message: "Server Error", error: error.message });
            }
        });

      //appoinment s 

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Keep connection open
    }
}
run().catch(console.dir);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});