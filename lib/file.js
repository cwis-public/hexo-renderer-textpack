(function() {

"use strict";

var Textpack = require("./textpack");

var File = require("hexo/lib/box/file.js");

exports.initialize = function() {
	var oldRead = File.prototype.read;
	File.prototype.read = function() {
		var self = this;
		if(self.source.match(/\.textpack$/)) {
			return new Promise(function(resolve) {
				var textpack = new Textpack({ path: self.source });
				textpack.open()
					.then(function() {
						resolve(textpack.text);
					});
			});
		} else {
			return oldRead.apply(this, arguments);
		}
	};

	var oldWrite = File.prototype.write;
	File.prototype.write = function() {
		var self = this;
		if(self.source.match(/\.textpack$/)) {
			return Promise.reject("Cannot write .textpack files");
		} else {
			return oldWrite.apply(this, arguments);
		}
	};
};

})();
