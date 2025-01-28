import mongoose from 'mongoose'
const CustomerSchema = new mongoose.Schema({
  customerName: String,
  fatherName: String,
  phoneNumber: String,
  village: String,
  details: String,
  dueHistory: [
    {
      date: Date,
      amountDue: Number,
    }
  ],
  paymentHistory: [
    {
      date: Date,
      amountPaid: Number,
    }
  ],
});



const Customer = mongoose.models.Customer || mongoose.model("Customer", CustomerSchema);

export default Customer;
