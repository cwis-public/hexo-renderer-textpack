var Textpack = require("../lib/textpack.js");

var FILE = "./examples/example.textpack";

process.on("uncaughtException", function(err) {
	console.error(err);
});
process.on("unhandledRejection", function(err) {
	console.error(err, err.stack);
});

var tp = new Textpack({ path: FILE });
tp.open().then(function() {
	console.log("done");
}).catch(function(err) {
	console.error(err);
});
