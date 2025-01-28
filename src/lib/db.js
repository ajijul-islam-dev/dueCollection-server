import mongoose from 'mongoose';

let db ;

 const connectDB = async()=>{
  if(db){
    return db;
  }
  try{
    const uri = process.env.MONGODB_URI;
    db = await mongoose.connect(uri).then(()=>{
      console.log('mongodb connected successfully')
    })
    .catch((error)=>{
      console.log(error)
    })
    
    return db
  }catch(error){
    console.log(error)
  }
}

export default connectDB