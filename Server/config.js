const mongoose = require('mongoose');

const mongoURI = process.env.MONOGOURL;

const connect = async () =>{
	try {
		await mongoose.connect(mongoURI);
		console.log('Connected to Mongo!');
	} catch (error) {
		console.log('Error connecting to Mongo: ', error);
	}
}

module.exports = connect;