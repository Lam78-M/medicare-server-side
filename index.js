const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
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


const JWKS = createRemoteJWKSet(
    new URL("http://localhost:3000/api/auth/jwks")
)

const  verifyToken = async (req, res, next)=>{
    const  authHeader = req?.headers.authorization;

     if(!authHeader){
        return res.status(401).json({message: "Unauthorized"})
     }
    const token = authHeader.split(" ")[1];
    if(!token){
        return res.status(401).json({message: "Unauthorized"})
    }
    
     try{
           const {payload} = await jwtVerify(token, JWKS)
   console.log(payload)
     next()

     }catch(error){
    return res.status(403).json({
        message:"Forbidden"
    })
     } 
};

async function run() {
    try {
        await client.connect();
        const database = client.db("medicare_user");
        const doctorsCollection = database.collection("doctors");
        const appointmentCollection = database.collection("appointments");
        const reviewsCollection = database.collection("reviews");
        const usersCollection = database.collection("user");
      const prescriptionCollection = database.collection("prescriptions");

// -------------------------------------------------------------
app.post('/api/prescriptions/save',verifyToken,  async (req, res) => {
    try {
  
        const { appointmentId, patientName, patientEmail, patientId, doctorEmail, symptoms, medicines, advice } = req.body;
        console.log("Payload received at backend:", req.body);

        if (!appointmentId) {
            return res.status(400).json({ success: false, message: "Appointment ID is strictly required!" });
        }
        
        const filter = { appointmentId: appointmentId }; 
        
        const updateDoc = {
            $set: {
                patientName: patientName,
                patientEmail: patientEmail ? patientEmail.trim().toLowerCase() : "", 
                patientId: patientId || "", 
                doctorEmail: doctorEmail ? doctorEmail.trim().toLowerCase() : "", 
                symptoms: symptoms,
                medicines: medicines,
                advice: advice,
                date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
                updatedAt: new Date()
            }
        }; 
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

// To see all prescription
app.get('/api/prescriptions/all', verifyToken, async (req, res) => {
    try {
        const history = await prescriptionCollection.find({}).sort({ updatedAt: -1 }).toArray();
        res.status(200).json(history);
    } catch (error) {
        console.error("Fetch Prescription History Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});
  
        // User profiel route (Phone, Gender Dynamic Update Pipeline)
    
        app.put('/api/user/update-profile', verifyToken, async (req, res) => {
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

        // 2. Fetch User Profile Data by Email ------------------

        app.get('/api/user/:email', verifyToken, async (req, res) => {
            try {
                const { email } = req.params;
                const user = await usersCollection.findOne({ email: email });
            
                if (!user) {
                    return res.status(200).json(null);
                }
                res.status(200).json(user);
            } catch (error) {
                console.error("Fetch User Profile Error:", error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // 🔍 ১. সব ইউজার নিয়ে আসার এপিআই (usersCollection নাম ঠিক রেখে)
app.get('/api/admin/all-user', verifyToken, async (req, res) => {
    try {
        // তোমার কালেকশনের সঠিক নাম usersCollection ব্যবহার করা হলো
        const result = await usersCollection.find({}).sort({ _id: -1 }).toArray();
        
        // প্রতিটি ইউজারের role বা status না থাকলে ডিফল্ট ভ্যালু সেট করা
        const updatedUsers = result.map(user => ({
            ...user,
            role: user.role || "patient",       
            status: user.status || "active"     
        }));
        
        res.status(200).json(updatedUsers); // ফ্রন্টএন্ড যাতে খাঁটি JSON পায়
    } catch (error) {
        console.error("Fetch All Users Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 🔄 ২. ইউজারের স্ট্যাটাস আপডেট করার এপিআই
app.put('/api/admin/update-user-status', verifyToken, async (req, res) => {
    try {
        const { id, status } = req.body; 
        if (!id || !status) {
            return res.status(400).json({ success: false, message: "ID and Status are required!" });
        }

        // এখানেও usersCollection ব্যবহার করা হয়েছে
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { status: status } };

        const result = await usersCollection.updateOne(filter, updateDoc);
        if (result.modifiedCount > 0) {
            res.status(200).json({ success: true, message: `User status updated to ${status}! 🔄` });
        } else {
            res.status(404).json({ success: false, message: "User not found or status already same." });
        }
    } catch (error) {
        console.error("Update User Status Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 🔴 ৩. ইউজার ডিলিট করার এপিআই
app.delete('/api/admin/delete-user', verifyToken, async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ success: false, message: "User ID is required!" });
        }

        // এখানেও usersCollection
        const filter = { _id: new ObjectId(id) };
        const result = await usersCollection.deleteOne(filter);

        if (result.deletedCount > 0) {
            res.status(200).json({ success: true, message: "User permanently deleted! ❌" });
        } else {
            res.status(404).json({ success: false, message: "User not found." });
        }
    } catch (error) {
        console.error("Delete User Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});
     
        // 1. Post a Doctor Review

// 🚀 4. Get ALL Reviews From Database Pipeline (Direct Stream)
app.get('/api/v1/reviews', verifyToken, async (req, res) => {
    try {
        const reviews = await reviewsCollection.find({}).toArray();
        console.log(`Total database review count logs found:`, reviews.length); 
        res.status(200).json({ success: true, reviews });
    } catch (error) {
        console.error("Backend Global Review Fetch Error:", error);
        res.status(500).json({ success: false, message: "Error fetching global reviews cluster" });
    }
});


        app.post("/api/v1/reviews", verifyToken, async (req, res) => {
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
app.get('/api/v1/reviews/doctor/:doctorId', verifyToken, async (req, res) => {
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

// 📌 ডক্টরের প্রোফাইল বায়ো আপডেট করার পারফেক্ট app.patch এপিআই
app.patch('/api/doctors/update-profile/:id', verifyToken, async (req, res) => {
    try {
        const doctorId = req.params.id;
        const { qualifications, specialization, experience, hospitalName, profileImage } = req.body;
        const { ObjectId } = require('mongodb'); 

        // 🎯 সমাধান: কালেকশনের নাম "doctors" করে দেওয়া হলো, যেখানে মেইন আইডি ডক্টরের নিজের আইডি
        const result = await database.collection("doctors").updateOne(
            { _id: new ObjectId(doctorId) }, 
            {
                $set: {
                    qualifications: qualifications,
                    specialization: specialization,
                    experience: Number(experience), 
                    hospitalName: hospitalName,
                    profileImage: profileImage
                }
            }
        );

        if (result.matchedCount === 1) {
            res.status(200).json({ success: true, message: "Doctor profile updated successfully! 🏛️" });
        } else {
            res.status(404).json({ success: false, message: "No doctor found with this ID!" });
        }
    } catch (error) {
        console.error("Database patching error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

// 3. Get Patient Reviews by ID (Direct Filter)
app.get('/api/v1/reviews/patient/:patientId', verifyToken, async (req, res) => {
    try {
        const { patientId } = req.params;
        console.log("Requested Patient ID from Frontend:", patientId);

        let query = { patientId: patientId }; 
        if (ObjectId.isValid(patientId)) {
            query = {
                $or: [
                    { patientId: patientId },                
                    { patientId: new ObjectId(patientId) }   
                ]
            };
        }

        const reviews = await reviewsCollection.find(query).toArray();
        console.log(`Found reviews count given by this patient:`, reviews.length); 

        res.status(200).json({ success: true, reviews });
    } catch (error) {
        console.error("Backend Patient Review Fetch Error:", error);
        res.status(500).json({ success: false, message: "Error fetching patient reviews" });
    }
});

// 🟢 ডক্টরের ইমেইল দিয়ে তার আইডি খুঁজে বের করার API
app.get('/api/v1/doctors/profile', verifyToken, async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email query is required" });
        }

        // তোমার ডক্টর কালেকশনের নাম অনুযায়ী পরিবর্তন করে নিও (e.g., doctorsCollection)
        const doctor = await database.collection("doctors").findOne({ email: email.trim().toLowerCase() });
        
        if (!doctor) {
            return res.status(404).json({ success: false, message: "Doctor not found" });
        }

        // ডক্টরের আইডি এবং অন্যান্য প্রয়োজনীয় ইনফো পাঠিয়ে দিচ্ছি
        res.status(200).json({ success: true, doctorId: doctor._id.toString(), doctorName: doctor.name });
    } catch (error) {
        console.error("Error fetching doctor profile:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

 
app.delete('/api/appointments/delete/:id', verifyToken, async (req, res) => {
    try {
        const appointmentId = req.params.id;
        const { ObjectId } = require('mongodb'); // অবজেক্ট আইডি ইম্পোর্ট

        const result = await database.collection("appointments").deleteOne({
            _id: new ObjectId(appointmentId)
        });

        if (result.deletedCount === 1) {
            res.status(200).json({ success: true, message: "Appointment deleted! 🗑️" });
        } else {
            res.status(404).json({ success: false, message: "Appointment not found!" });
        }
    } catch (error) {
        console.error("Delete error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});


app.get("/api/appointments/patient", verifyToken, async (req, res) => {
    const email = req.query.email;
    // ডাটাবেজের ফিল্ডের নাম যেহেতু userEmail, তাই কুয়েরিটা এমন হওয়া উচিত:
    const query = { userEmail: email }; 
    const result = await appointmentCollection.find(query).toArray();
    res.send(result);
});                                                    


        app.post('/api/appointments', verifyToken, async (req, res) => {
            try {
                const bookingData = req.body;
                const result = await appointmentCollection.insertOne(bookingData);
                res.status(201).json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // 2. Get All Appointments
        app.get('/api/appointments',  verifyToken, async (req, res) => {
            try {
                const appointments = await appointmentCollection.find({}).toArray();
                res.status(200).json(appointments);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        

        // 3. Get Appointments for Particular Patient (Matches your Frontend HeroUI view)
        app.get('/api/appointments/patient', verifyToken, async (req, res) => {
            try {
                const email = req.query.email;
                if (!email) {
                    return res.status(400).json({ error: "Patient email is required as query parameter" });
                }
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

        app.get('/api/appointments/doctor', verifyToken, async (req, res) => {
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

        app.patch('/api/appointments/approve/:id', verifyToken, async (req, res) => {
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

        // 6. Reschedule Appointment 
        
        app.patch('/api/appointments/:id', verifyToken, async (req, res) => {
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

        app.delete('/api/appointments/:id', verifyToken, async (req, res) => {
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

        app.get("/api/v1/patient-appointments/:email", verifyToken, async (req, res) => {
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
const { ObjectId } = require('mongodb');


app.get('/api/doctors',verifyToken, async (req, res) => {
    try {
        const search = req.query.search;
        const specialization = req.query.specialization;
        const sort = req.query.sort;
        
        // 🎯 এখানে ফিল্টার করা হলো যেন পেশেন্টরা শুধু "Verified" ডাক্তারদের দেখে
        let query = { 
            verificationStatus: { $regex: /^verified$/i } 
        };

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

// ==========================================
// ২. অ্যাডমিন প্যানেল: পেন্ডিং ও ভেরিফাইড সব ডাক্তার দেখার রাউট
// ==========================================
app.get('/api/admin/pending-doctors', verifyToken, async (req, res) => {
    try {
        const query = { 
            verificationStatus: { $in: ["Pending", "pending", "Verified", "verified"] } 
        };
        const result = await doctorsCollection.find(query).sort({ _id: -1 }).toArray();
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Server Error", error: error.message });
    }
});

// ==========================================
// ৩. অ্যাডমিন অ্যাকশন: Approve Doctor (স্ট্যাটাস হবে "Verified")
// ==========================================
app.put('/api/admin/approve-doctor', verifyToken, async (req, res) => { // 🎯 ইউআরএল ফিক্স করা হয়েছে
    try {
        const { id } = req.body;
        if (!id) return res.status(400).send({ message: "Doctor ID is required!" });

        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { verificationStatus: "Verified" } };

        const result = await doctorsCollection.updateOne(filter, updateDoc);
        if (result.modifiedCount > 0) {
            res.send({ success: true, message: "Doctor successfully approved! 🎉" });
        } else {
            res.status(404).send({ success: false, message: "Doctor not found or already verified." });
        }
    } catch (error) {
        res.status(500).send({ message: "Server Error", error: error.message });
    }
});

// ==========================================
// ৪. অ্যাডমিন অ্যাকশন: Cancel Verify (স্ট্যাটাস আবার হবে "Pending")
// ==========================================
app.put('/api/admin/cancel-verify', verifyToken, async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).send({ message: "Doctor ID is required!" });

        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { verificationStatus: "Pending" } };

        const result = await doctorsCollection.updateOne(filter, updateDoc);
        if (result.modifiedCount > 0) {
            res.send({ success: true, message: "Verification cancelled successfully! ↩️" });
        } else {
            res.status(404).send({ success: false, message: "Doctor not found or status already Pending." });
        }
    } catch (error) {
        res.status(500).send({ message: "Server Error", error: error.message });
    }
});

// ==========================================
// ৫. অ্যাডমিন অ্যাকশন: Reject License (ডাটাবেজ থেকে ডিলিট)
// ==========================================
app.delete('/api/admin/reject-doctor', verifyToken, async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).send({ message: "Doctor ID is required!" });

        const filter = { _id: new ObjectId(id) };
        const result = await doctorsCollection.deleteOne(filter);

        if (result.deletedCount > 0) {
            res.send({ success: true, message: "Doctor license rejected & removed! ❌" });
        } else {
            res.status(404).send({ success: false, message: "Doctor profile not found." });
        }
    } catch (error) {
        res.status(500).send({ message: "Server Error", error: error.message });
    }
});

            //doctors slot update

    app.patch('/api/doctors/update-slots/:id', verifyToken, async (req, res) => {
    try {
        const doctorId = req.params.id;
        const { availableDays, availableSlots } = req.body;

        if (!ObjectId.isValid(doctorId)) {
            return res.status(400).json({ message: "Invalid Doctor ID format! ❌" });
        }

        const filter = { _id: new ObjectId(doctorId) };
        const updateDoc = {
            $set: {
                availableDays: availableDays,  
                availableSlots: availableSlots  
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

                   //  doctors bio update

// 🩺 DOCTOR BIO UPDATE (100% Tested Standard Router)
app.patch('/api/doctors/update-profile/:id', verifyToken, async (req, res) => {
    try {
        const doctorId = req.params.id;
        const { qualifications, specialization, experience, hospitalName } = req.body;

        // Validation target hex criteria check format
        if (!doctorId || doctorId === "undefined" || !ObjectId.isValid(doctorId)) {
            return res.status(400).json({ success: false, message: "Invalid Doctor ID format received by server! ❌" });
        }

        const filter = { _id: new ObjectId(doctorId) };
        const updateDoc = {
            $set: {
                qualifications: qualifications || "",
                specialization: specialization || "",
                experience: experience ? Number(experience) : 0,
                hospitalName: hospitalName || "",
                updatedAt: new Date() 
            }
        };

        const result = await doctorsCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: "Doctor record target not matching in DB! 🔍" });
        }

        return res.status(200).json({ 
            success: true, 
            message: "Medical profile schema synchronized successfully! 🏛️🩺", 
            result 
        });

    } catch (error) {
        console.error("Backend exception mapping:", error);
        return res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
});
        // 2. Get Single Doctor by ID

        app.get('/api/doctors/:id', verifyToken, async (req, res) => {
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