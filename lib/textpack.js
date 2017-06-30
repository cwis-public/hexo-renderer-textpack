(function() {

"use strict";

var fs = require("fs"),
    unzip = require("unzip");

function streamToBuffer(stream) {
	return new Promise(function(resolve, reject) {
		var buffers = [];
		stream
			.on('data', function(buffer) {
				buffers.push(buffer);
			})
			.on('end', function() {
				resolve(Buffer.concat(buffers));
			});
	});
}

function streamToString(stream) {
	return streamToBuffer(stream).then(function(buffer) {
		return Promise.resolve(buffer.toString());
	});
}

function Textpack(options) {
	this.options = options;
	this.assets = {};
}

Textpack.prototype._parse = function _parse() {
	return new Promise(function(resolve, reject) {
		var entryInfo, entryText, assetsList = [];
		fs.createReadStream(this.options.path)
			.pipe(unzip.Parse())
			.on('error', reject)
			.on('entry', function(entry) {
				var path = entry.path;
				var m = path.match(/^(?:[^\/]+\/)?([^\/]+)$/);
				if(m) {
					let name = m[1];
					if(name === "info.json") {
						entryInfo = entry;
						return;
					} else if(name.match(/^text\./)) {
						this.textName = name;
						entryText = entry;
						return;
					}
				}
				m = path.match(/^(?:[^\/]+\/)?(assets\/[^\/]+)$/);
				if(m) {
					let name = m[1];
					assetsList.push({ name: name, entry: entry });
					return;
				}
				entry.autodrain();
			}.bind(this))
			.on('close', function() {
				resolve({ entryInfo, entryInfo, entryText, entryText, assetsList: assetsList });
			}.bind(this));
	}.bind(this));
};

Textpack.prototype._processInfo = function _processInfo(entryInfo) {
	var self = this;
	return new Promise(function(resolve) {
		streamToString(entryInfo).then(function(info) {
			self.info = JSON.parse(info);
			resolve();
		});
	});
};

Textpack.prototype._processText = function _processText(entryText) {
	var self = this;
	return new Promise(function(resolve) {
		streamToString(entryText).then(function(text) {
			self.text = text;
			resolve();
		});
	});
};

Textpack.prototype._processAssets = function _processAssets(assetsList) {
	var self = this;
	return Promise.all(assetsList.map(function(asset) {
		return new Promise(function(resolve) {
			streamToBuffer(asset.entry)
				.then(function(buffer) {
					self.assets[asset.name] = buffer;
					return resolve();
				});
		});
	}));
};

Textpack.prototype.open = function open(options) {
	var self = this;
	return new Promise(function(resolve, reject) {
		self._parse(options)
			.catch(reject)
			.then(function(parsedData) {
				Promise.all([
					self._processInfo(parsedData.entryInfo),
					self._processText(parsedData.entryText),
					self._processAssets(parsedData.assetsList)
				])
					.catch(reject)
					.then(function() {
						resolve();
					});
			});
	});
};

module.exports = Textpack;

})();
