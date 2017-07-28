(function() {

"use strict";

var fs = require("hexo-fs"),
    archiver = require("archiver"),
    AdmZip = require("adm-zip");  // we use this module because Ulysses.app is very weird when saving textpack files, and this is one of the rare module that knows how to read such textpack files

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

function openZipEntries(path) {
	return new Promise(function(resolve, reject) {
		var nTry = 0;
		var doTry = function() {
			try {
				var zipFile = new AdmZip(path);
				var zipEntries = zipFile.getEntries();
				return resolve(zipEntries);
			} catch(e) {
				if(nTry === 4) {
					return reject(e);
				}
				nTry++;
				setTimeout(doTry, 1000);
			}
		};
		doTry();
	});
}

Textpack.prototype._parse = function _parse() {
	var self = this;
	return new Promise(function(resolve, reject) {
		var entryInfo, entryText, assetsList = [];
		openZipEntries(self.options.path)
			.catch(reject)
			.then(function(zipEntries) {
				zipEntries.forEach(function(entry) {
					var path = entry.entryName;
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
				});
				resolve({ entryInfo: entryInfo, entryText: entryText, assetsList: assetsList });
			});
	});
};

Textpack.prototype._processInfo = function _processInfo(entryInfo) {
	var self = this;
	return new Promise(function(resolve) {
		self.info = JSON.parse(entryInfo.getData().toString('utf-8'));
		resolve();
	});
};

Textpack.prototype._processText = function _processText(entryText) {
	var self = this;
	return new Promise(function(resolve) {
		self.text = entryText.getData().toString('utf-8');
		resolve();
	});
};

Textpack.prototype._processAssets = function _processAssets(assetsList) {
	var self = this;
	return Promise.all(assetsList.map(function(asset) {
		return new Promise(function(resolve) {
			self.assets[asset.name] = asset.entry.getData();
			return resolve();
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

Textpack.prototype.getTemporaryStream = function() {
	var self = this;
	return new Promise(function(resolve, reject) {
		var postfix = 0;
		var tryOpen = function() {
			var path = self.options.path + ".tmp" + (postfix? postfix: "");
			fs.open(path, "wx")
				.catch(function(err) {
					postfix++;
					if(postfix > 10) {
						reject(err);
					}
					setImmediate(tryOpen);
				})
				.then(function(fd) {
					if(fd) {
						var stream = fs.createWriteStream(path, { fd: fd });
						resolve({ path: path, stream: stream });
					}
				});
		};
		tryOpen();
	});
};

Textpack.prototype.write = function write(text) {
	var self = this;
	return new Promise(function(resolve, reject) {
		self.getTemporaryStream()
			.catch(reject)
			.then(function(tempInfo) {
				var stream = tempInfo.stream, tempPath = tempInfo.path;
				var archive = archiver('zip', { zlib: { level: 9 } });
				archive
					.pipe(stream)
					.on('error', function(err) {
						reject(err);
					});
				stream.on('close', function() {
					fs.rename(tempPath, self.options.path)
						.then(function() {
							return resolve();
						})
						.catch(reject);
				});

				var zipFile = new AdmZip(self.options.path);
				var zipEntries = zipFile.getEntries();
				zipEntries.forEach(function(entry) {
					var path = entry.entryName;
					if(path.match(/text\.[^\/]/)) {
						archive.append(text, { name: path });
					} else {
						archive.append(entry.getData(), { name: path });
					}
				});
				archive.finalize();
			});
	});
};

module.exports = Textpack;

})();
