const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Medicare Server is running smoothly! 🚀');
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
        
        // --- Core Collections ---
        const doctorsCollection = database.collection("doctors");
        const appointmentCollection = database.collection("appointments");
        const reviewsCollection = database.collection("reviews");
        const usersCollection = database.collection("user");
        const prescriptionCollection = database.collection("prescriptions")

// -------------------------------------------------------------
        // 💊 PRESCRIPTION ROUTES (MongoDB Native Upsert Pipeline)
        // -------------------------------------------------------------

        // ১. প্রেসক্রিপশন তৈরি অথবা মডিফাই করার API (কার্ড ডুপ্লিকেট হবে না)
       // ১. প্রেসক্রিপশন তৈরি অথবা মডিফাই করার API

// 💊 PRESCRIPTION ROUTE (Upsert Pipeline for Save & Update)
app.post('/api/prescriptions/save', async (req, res) => {
    try {
        const { appointmentId, patientName, symptoms, medicines, advice } = req.body;
        
        console.log("📥 Payload received at backend:", req.body);

        if (!appointmentId) {
            return res.status(400).json({ success: false, message: "Appointment ID is strictly required!" });
        }

        // মঙ্গোডিবি ফিল্টার: এই appointmentId দিয়ে খুঁজবে
        const filter = { appointmentId: appointmentId }; 
        
        const updateDoc = {
            $set: {
                patientName: patientName,
                symptoms: symptoms,
                medicines: medicines,
                advice: advice,
                // প্রতিটি আপডেটের সময় কারেন্ট ডেট সিঙ্ক করবে
                date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
                updatedAt: new Date()
            }
        };

        // upsert: true থাকার কারণে আইডি ম্যাচ করলে ওটার ওপরেই আপডেট হবে, ম্যাচ না করলে নতুন ডকুমেন্ট হবে।
        const options = { upsert: true }; 
        const result = await prescriptionCollection.updateOne(filter, updateDoc, options);

        res.status(200).json({ 
            success: true, 
            message: "Prescription seamlessly synced with MongoDB Atlas! 🎉", 
            result 
        });
    } catch (error) {
        console.error("❌ Backend Upsert Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});
        // ২. সব প্রেসক্রিপশন একসাথে দেখার জন্য API (History Page-এর জন্য)
        app.get('/api/prescriptions/all', async (req, res) => {
            try {
                // .sort({ updatedAt: -1 }) দেওয়াতে একদম লেটেস্ট প্রেসক্রিপশনগুলো সবার উপরে দেখাবে
                const history = await prescriptionCollection.find({}).sort({ updatedAt: -1 }).toArray();
                res.status(200).json(history);
            } catch (error) {
                console.error("Fetch Prescription History Error:", error);
                res.status(500).json({ success: false, error: error.message });
            }
        });


        // -------------------------------------------------------------
        // 👤 USER PROFILE ROUTES (Phone, Gender Dynamic Update Pipeline)
        // -------------------------------------------------------------
        
        // 1. Update/Upsert User Profile (Frontend context logic triggers this)
        app.put('/api/user/update-profile', async (req, res) => {
            try {
                const { email, name, phone, gender } = req.body;
                if (!email) {
                    return res.status(400).json({ success: false, message: "User email is strictly required!" });
                }

                const filter = { email: email };
                const updateDoc = {
                    $set: {
                        name: name,
                        phone: phone,
                        gender: gender,
                        updatedAt: new Date()
                    }
                };
                
                // upsert: true mane holo data thakle update hobe, na thakle automatic collection e insert hobe bondhu!
                const options = { upsert: true }; 
                const result = await usersCollection.updateOne(filter, updateDoc, options);

                res.status(200).json({ 
                    success: true, 
                    message: "Profile synchronized and saved successfully! 🎉", 
                    result 
                });
            } catch (error) {
                console.error("Profile Update Error:", error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // 2. Fetch User Profile Data by Email (Booking Page and Settings Page will call this)
        app.get('/api/user/:email', async (req, res) => {
            try {
                const { email } = req.params;
                const user = await usersCollection.findOne({ email: email });
                
                // Jodi profile thake data pathabe, nahole empty payload response object safely trigger korbe
                if (!user) {
                    return res.status(200).json(null);
                }
                res.status(200).json(user);
            } catch (error) {
                console.error("Fetch User Profile Error:", error);
                res.status(500).json({ success: false, error: error.message });
            }
        });
        // -------------------------------------------------------------
        // ⭐ REVIEWS ROUTES
        // -------------------------------------------------------------
        
        // 1. Post a Doctor Review
        app.post("/api/v1/reviews", async (req, res) => {
            try {
                const reviewData = {
                    ...req.body,
                    createdAt: new Date()
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


      // 2. Get Doctor Reviews by ID (Updated with String & ObjectId Support)
app.get('/api/v1/reviews/doctor/:doctorId', async (req, res) => {
    try {
        const { doctorId } = req.params;
        console.log("Requested Doctor ID from Frontend:", doctorId);

        let query = { doctorId: doctorId }; 
        if (ObjectId.isValid(doctorId)) {
            query = {
                $or: [
                    { doctorId: doctorId },                
                    { doctorId: new ObjectId(doctorId) }   
                ]
            };
        }

        const reviews = await reviewsCollection.find(query).toArray();
        console.log(`Found reviews count for this doctor:`, reviews.length); 

        res.status(200).json({ success: true, reviews });
    } catch (error) {
        console.error("Backend Review Fetch Error:", error);
        res.status(500).json({ success: false, message: "Error fetching reviews" });
    }
});


        // -------------------------------------------------------------
        // 📅 APPOINTMENTS ROUTES
        // -------------------------------------------------------------

        // 1. Post/Book Appointment
        app.post('/api/appointments', async (req, res) => {
            try {
                const bookingData = req.body;
                const result = await appointmentCollection.insertOne(bookingData);
                res.status(201).json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // 2. Get All Appointments
        app.get('/api/appointments', async (req, res) => {
            try {
                const appointments = await appointmentCollection.find({}).toArray();
                res.status(200).json(appointments);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // 3. Get Appointments for Particular Patient (Matches your Frontend HeroUI view)
        app.get('/api/appointments/patient', async (req, res) => {
            try {
                const email = req.query.email;
                if (!email) {
                    return res.status(400).json({ error: "Patient email is required as query parameter" });
                }
                
                // Safety Layer: Checks fields interchangeably 
                const query = {
                    $or: [
                        { userEmail: email },
                        { email: email },
                        { patientEmail: email }
                    ]
                };
                
                const appointments = await appointmentCollection.find(query).toArray();
                res.status(200).json(appointments);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // 4. Get Appointments for Doctor Dashboard
        app.get('/api/appointments/doctor', async (req, res) => {
            try {
                const { email } = req.query; 
                if (!email) {
                    return res.status(400).json({ message: "Email is required" });
                }

                const appointments = await appointmentCollection.find({ doctorEmail: email }).toArray();
                res.status(200).json(appointments);
            } catch (error) {
                console.error("Doctor Appointment Fetch Error:", error);
                res.status(500).json({ message: "Server Error", error: error.message });
            }
        });

        // 5. Approve Appointment Status
        app.patch('/api/appointments/approve/:id', async (req, res) => {
            try {
                const id = req.params.id;
                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ success: false, message: "Invalid Appointment ID format" });
                }

                const filter = { _id: new ObjectId(id) };
                const updateDoc = { $set: { status: 'Approved' } };

                const result = await appointmentCollection.updateOne(filter, updateDoc);

                if (result.modifiedCount === 1 || result.matchedCount === 1) {
                    res.status(200).json({ success: true, message: "Appointment approved successfully! 🎉" });
                } else {
                    res.status(400).json({ success: false, message: "No data changed or appointment not found." });
                }
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // 6. Reschedule Appointment (Frontend HeroUI triggered)
        app.patch('/api/appointments/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const { appointmentDate, appointmentDay, appointmentTime } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ success: false, message: "Invalid Appointment ID format" });
                }

                const filter = { _id: new ObjectId(id) };
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
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // 7. Delete / Cancel Appointment
        app.delete('/api/appointments/:id', async (req, res) => {
            try {
                const id = req.params.id;
                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ success: false, message: "Invalid Appointment ID format" });
                }

                const query = { _id: new ObjectId(id) };
                const result = await appointmentCollection.deleteOne(query);

                if (result.deletedCount === 1) {
                    res.status(200).json({ success: true, message: "Appointment canceled successfully! 🛑" });
                } else {
                    res.status(404).json({ success: false, message: "No appointment found with this ID" });
                }
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // 8. Fetch Unique Doctor List for Review Filters
        app.get("/api/v1/patient-appointments/:email", async (req, res) => {
            try {
                const { email } = req.params;
                if (!email) {
                    return res.status(400).json({ success: false, message: "Email parameter is required" });
                }

                const appointments = await appointmentCollection.find({
                    $or: [
                        { userEmail: email },
                        { email: email },
                        { patientEmail: email }
                    ]
                }).toArray();

                if (!appointments || appointments.length === 0) {
                    return res.status(200).json({ success: true, doctors: [] });
                }

                const uniqueDoctorsMap = {};
                appointments.forEach(appnt => {
                    const docId = appnt.doctorId || appnt.id || appnt._id;
                    const docName = appnt.doctorName || appnt.name;

                    if (docId) {
                        uniqueDoctorsMap[docId] = {
                            id: docId,
                            doctorId: docId,
                            name: docName || "Unknown Doctor",
                            doctorName: docName || "Unknown Doctor",
                            specialization: appnt.specialization || ""
                        };
                    }
                });

                res.status(200).json({
                    success: true,
                    doctors: Object.values(uniqueDoctorsMap)
                });
            } catch (error) {
                res.status(500).json({ success: false, message: "Server API crash!", error: error.message });
            }
        });

        // -------------------------------------------------------------
        // 👨‍⚕️ DOCTORS ROUTE
        // -------------------------------------------------------------
        
        // 1. Get All Doctors with Filters & Sorting
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

                const result = await doctorsCollection.find(query).sort(sortOption).toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Server Error", error: error.message });
            }
        });

            const { ObjectId } = require('mongodb'); // ফাইলের একদম উপরে এই লাইনটি না থাকলে যোগ করে নিবে

// 🚀 ডক্টরের স্লট ও দিন আপডেট করার PATCH রাউট
app.patch('/api/doctors/update-slots/:id', async (req, res) => {
    try {
        const doctorId = req.params.id;
        const { availableDays, availableSlots } = req.body;

        // ভ্যালিডেশন: আইডি ঠিক আছে কি না চেক করা
        if (!ObjectId.isValid(doctorId)) {
            return res.status(400).json({ message: "Invalid Doctor ID format! ❌" });
        }

        // ডাটাবেজে নির্দিষ্ট ডক্টরের প্রোফাইল আপডেট করা
        const filter = { _id: new ObjectId(doctorId) };
        const updateDoc = {
            $set: {
                availableDays: availableDays,   // ফ্রন্টএন্ড থেকে আসা নতুন ডেস অ্যারে
                availableSlots: availableSlots  // ফ্রন্টএন্ড থেকে আসা [{time, isBooked}] অ্যারে
            }
        };

        const result = await doctorsCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "Doctor profile not found! 🔍" });
        }

        res.status(200).json({ 
            success: true, 
            message: "Database architecture synchronized! 🚀", 
            result 
        });

    } catch (error) {
        console.error("Error updating doctor slots:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});

// 🚀 ডক্টরের প্রোফাইল বায়ো আপডেট করার PATCH রাউট (Frontend Editor এর জন্য)
app.patch('/api/doctors/update-profile/:id', async (req, res) => {
    try {
        const doctorId = req.params.id;
        const { qualifications, specialization, experience, hospitalName, profileImage } = req.body;

        // ১. ভ্যালিডেশন: আইডি ঠিক আছে কি না চেক করা
        if (!ObjectId.isValid(doctorId)) {
            return res.status(400).json({ success: false, message: "Invalid Doctor ID format! ❌" });
        }

        // ২. ফিল্টার এবং আপডেট অবজেক্ট তৈরি
        const filter = { _id: new ObjectId(doctorId) };
        const updateDoc = {
            $set: {
                qualifications: qualifications,
                specialization: specialization,
                experience: experience,
                hospitalName: hospitalName,
                profileImage: profileImage,
                updatedAt: new Date() // কখন আপডেট হলো ট্র্যাকিংয়ের জন্য
            }
        };

        // ৩. ডাটাবেজে আপডেট অপারেশন এক্সিকিউট করা
        const result = await doctorsCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: "Doctor profile not found! 🔍" });
        }

        res.status(200).json({ 
            success: true, 
            message: "Medical profile schema synchronized successfully! 🏛️🩺", 
            result 
        });

    } catch (error) {
        console.error("Error updating doctor profile:", error);
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
});

        // 2. Get Single Doctor by ID
        app.get('/api/doctors/:id', async (req, res) => {
            try {
                const id = req.params.id;
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
                res.status(500).send({ message: "Server Error", error: error.message });
            }
        });

        // --- Database Health Check ---
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB! 🎯");
    } finally {
        // Connection drops automatic block handled by driver
    }
}
run().catch(console.dir);

app.listen(port, () => {
    console.log(`Medicare Server listening on port ${port}`);
});