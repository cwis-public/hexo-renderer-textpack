(function() {

"use strict";

var fs = require("hexo-fs"),
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

var cache = [];
function loadFromCache(path, last_modified) {
	return new Promise(function(resolve) {
		var cached = cache[path];
		if(!cached || last_modified > cached.last_modified) {
			return resolve();
		}
		return resolve(cached.data);
	});
}
function saveIntoCache(path, last_modified, data) {
	return new Promise(function(resolve) {
		cache[path] = { last_modified: last_modified, data: data };
		resolve(data);
	});
}

Textpack.prototype._parse = function _parse() {
	var self = this;
	return new Promise(function(resolve, reject) {
		var entryInfo, entryText, assetsList = [];
		fs.createReadStream(self.options.path)
			.on('error', function(err) {
				reject(err);
			})
			.pipe(unzip.Parse())
			.on('error', function(err) {
				reject(err);
			})
			.on('entry', function(entry) {
				var path = entry.path;
				var m = path.match(/^(?:[^\/]+\/)?([^\/]+)$/);
				if(m) {
					let name = m[1];
					if(name === "info.json") {
						entryInfo = entry;
						return;
					} else if(name.match(/^text\./)) {
						self.textName = name;
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
			})
			.on('close', function() {
				resolve({ entryInfo: entryInfo, entryText: entryText, assetsList: assetsList });
			});
	});
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
		var mtime;
		fs.stat(self.options.path).then(function(stat) {
			mtime = stat.mtime;
			return loadFromCache(self.options.path, mtime);
		}).then(function(cached) {
			if(cached) {
				self.assets = cached.assets;
				self.text = cached.text;
				self.info = cached.info;
				self.textName = cached.textName;
				return resolve(cached);
			}

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
							saveIntoCache(self.options.path, mtime, {
								assets: self.assets,
								text: self.text,
								info: self.info,
								textName: self.textName
							});
							resolve();
						});
				});
		});
	});
};

module.exports = Textpack;

})();
