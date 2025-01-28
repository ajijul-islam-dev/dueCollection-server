import express from 'express';
import mongoose from 'mongoose'
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './lib/db.js';
import Customer from './models/Customer.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors({ origin: "*" }));

// Connect to MongoDB
connectDB();

// Test API
app.get('/', async (req, res) => {
  res.send("Server is connected")
});



//GET API FOR GETTING DUE INSIGHTS
app.get('/due-insights', async (req, res) => {
  try {
    const result = await Customer.aggregate([
      {
        $unwind: {
          path: "$dueHistory",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: null,
          totalDue: { $sum: { $ifNull: ["$dueHistory.amountDue", 0] } }
        }
      },
      {
        $lookup: {
          from: "customers",
          pipeline: [
            {
              $unwind: {
                path: "$paymentHistory",
                preserveNullAndEmptyArrays: true
              }
            },
            {
              $group: {
                _id: null,
                totalPaid: { $sum: { $ifNull: ["$paymentHistory.amountPaid", 0] } }
              }
            }
          ],
          as: "paymentData"
        }
      },
      {
        $unwind: {
          path: "$paymentData",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 0,
          totalDue: 1,
          totalPaid: { $ifNull: ["$paymentData.totalPaid", 0] },
          remainingDue: { $subtract: ["$totalDue", { $ifNull: ["$paymentData.totalPaid", 0] }] }
        }
      }
    ]);

    if (result.length === 0) {
      console.log("No matching data found");
    } else {
      console.log("Aggregation result:", result);
    }

    res.send(result.length > 0 ? result[0] : { totalDue: 0, totalPaid: 0, remainingDue: 0 });
  } catch (error) {
    console.error("Aggregation error:", error);
    res.status(500).send({ error: error.message });
  }
});



// POST API to insert customers
app.post('/customer', async (req, res) => {
  try {
    const result = await Customer.insertMany(customerData);
    res.status(201).json({ message: 'Customers added successfully', data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add customers' });
  }
});

//api to get customers..........
app.get('/customers', async (req, res) => {
  try {
    let matchStage = {};

    // Check and log query parameters
    console.log("Search:", req.query.search, "Village:", req.query.village);

    // Add filters based on `search` and `village` query parameters
    if (req.query.search && req.query.village) {
      matchStage = {
        customerName: { $regex: req.query.search, $options: 'i' },
        village: decodeURIComponent(req.query.village), // Ensure proper decoding
      };
    } else if (req.query.search) {
      matchStage = { customerName: { $regex: req.query.search, $options: 'i' } };
    } else if (req.query.village) {
      matchStage = { village: decodeURIComponent(req.query.village) }; // Decode village
    }

    // Aggregation pipeline
    const result = await Customer.aggregate([
      { $match: matchStage },
      {
        $unwind: {
          path: "$paymentHistory",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: "$_id",
          name: { $first: "$customerName" },
          village: { $first: "$village" },
          totalPaid: { $sum: { $ifNull: ["$paymentHistory.amountPaid", 0] } },
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          pipeline: [
            {
              $unwind: {
                path: "$dueHistory",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $group: {
                _id: "$_id",
                totalDue: { $sum: { $ifNull: ["$dueHistory.amountDue", 0] } },
              },
            },
          ],
          as: "dueData",
        },
      },
      {
        $unwind: {
          path: "$dueData",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          village: 1,
          remainingDue: {
            $subtract: [{ $ifNull: ["$dueData.totalDue", 0] }, "$totalPaid"],
          },
        },
      },
    ]);

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: error.message });
  }
});



// API FOR GETTING SPECIFIC CUSTOMER
app.get('/customers/:id', async (req, res) => {
  try {
    const id = req.params.id;

    const result = await Customer.aggregate([
  {
    $match: { _id: new mongoose.Types.ObjectId(id) } // Match by customer ID
  },
  {
    $addFields: {
      totalPaid: { $sum: "$paymentHistory.amountPaid" },
      totalDue: { $sum: "$dueHistory.amountDue" },
      remainingDue: {
        $subtract: [{ $sum: "$dueHistory.amountDue" }, { $sum: "$paymentHistory.amountPaid" }]
      }
    }
  },
  {
    $project: {
      _id: 1,
      customerName: 1,
      fatherName: 1,
      phoneNumber: 1,
      village: 1,
      details: 1,
      dueHistory: 1,
      paymentHistory: 1,
      totalPaid: 1,
      totalDue: 1,
      remainingDue: 1
    }
  }
]);


    if (result.length > 0) {
      res.send(result[0]); // Send the first (and only) document
    } else {
      res.status(404).send({ message: "Customer not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: error.message });
  }
});



//GET API FOR GETTING UNIQUE VILLAGES NAME
app.get('/village', async (req, res) => {
  const name = req.query.name;
  try {
    let query = {};
    if (name) {
      query = { village: { $regex: name, $options: 'i' } }; // Case-insensitive regex
    }
    const villages = await Customer.distinct('village', query);
    res.send(villages);
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: error.message });
  }
});

//POST API FOR SAVING CUSTOMER DETAILS IN DATABASE
app.post('/add-duer',async(req,res)=>{
  const userData = await req.body;
  try{
    const newCustomer = new Customer(userData);
    const result = await newCustomer.save();
    res.send(result)
  }
  catch(error){
    res.send(error.message)
  }
})

//PATCH API MAKING UPDATING paymentHistory
// Update payment history
app.patch("/customers/:id/payment", async (req, res) => {
  const { id } = req.params;
  const { date, amountPaid } = req.body;

  try {
    if (!date || !amountPaid) {
      return res.status(400).send({ message: "Date and amountPaid are required." });
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      id,
      {
        $push: {
          paymentHistory: { date, amountPaid },
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedCustomer) {
      return res.status(404).send({ message: "Customer not found" });
    }

    res.status(200).send(updatedCustomer);
  } catch (error) {
    console.error("Error updating payment history:", error);
    res.status(500).send({ error: error.message });
  }
});


// Update due history
app.patch("/customers/:id/due", async (req, res) => {
  const { id } = req.params;
  const { date, amountDue } = req.body;

  try {
    if (!date || !amountDue) {
      return res.status(400).send({ message: "Date and amountDue are required." });
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      id,
      {
        $push: {
          dueHistory: { date, amountDue },
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedCustomer) {
      return res.status(404).send({ message: "Customer not found" });
    }

    res.status(200).send(updatedCustomer);
  } catch (error) {
    console.error("Error updating due history:", error);
    res.status(500).send({ error: error.message });
  }
});


// Start server
app.listen(PORT, () => {
  console.log('Server is running under port', PORT);
});

