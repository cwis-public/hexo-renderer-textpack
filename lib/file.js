(function() {

"use strict";

var Textpack = require("./textpack"),
	File = require("hexo/lib/box/file.js"),
	EventEmitter = require("events"),
	Promise = require("bluebird"),
	nodeFs = require("fs"),
	util = 
		nodeFs.existsSync(__dirname + "/../../hexo/node_modules/hexo-util")? require(__dirname + "/../../hexo/node_modules/hexo-util"):
		nodeFs.existsSync(__dirname + "/../../hexo-util")? require(__dirname + "/../../hexo-util"): require("hexo-util"),
	fs = 
		nodeFs.existsSync(__dirname + "/../../hexo/node_modules/hexo-fs")? require(__dirname + "/../../hexo/node_modules/hexo-fs"):
		nodeFs.existsSync(__dirname + "/../../hexo-fs")? require(__dirname + "/../../hexo-fs"): require("hexo-fs"),
	stream = require("stream");

function setupHexoAdmin() {
	// hexo-admin has an editor that allows for overwritting of .textpack files very
	// easily, we prevent that by hooking on their hexo-fs API 
	var hexoAdminFs;
	setupHexoAdmin.ntry = (setupHexoAdmin.ntry || 0) + 1;
	if(!nodeFs.existsSync(__dirname + "/../../hexo-admin/node_modules/hexo-fs/")) {
		return;
	}
	try {
		hexoAdminFs = require("../../hexo-admin/node_modules/hexo-fs");
	} catch(e) {
		if(setupHexoAdmin.ntry < 10) {
			setTimeout(setupHexoAdmin, 1000).unref();
		}
		return;
	}
	hexoAdminFs.writeFile = fs.writeFile;
}

exports.initialize = function(hexo) {
	// install the various hooks around lib functions

	var sourceDirTextpackDynamic = hexo.base_dir + '-textpack-dynamic-/' + hexo.config.source_dir + '/';
	function splitTextpackAsset(path) {
		if(!path.match(/-textpack-dynamic-/)) {
			return null;
		}
		if(!path.match(sourceDirTextpackDynamic)) {
			return null;
		}
		path = path.replace("-textpack-dynamic-/", "");
		var m = path.match(/^(.*\.textpack)\/(.*)$/);
		if(m) {
			return { textpack: m[1], asset: m[2] };
		} else {
			return null;
		}
	}

	var sourceDirTextbundleDynamic = hexo.base_dir + '-textbundle-dynamic-/';
	function splitTextbundleAsset(path) {
		if(!path.match(/-textbundle-dynamic-/)) {
			return null;
		}
		if(!path.match(sourceDirTextbundleDynamic)) {
			return null;
		}
		path = path.replace("-textbundle-dynamic-/", "");
		var m = path.match(/^(.*\.textbundle)\/(.*)$/);
		if(m) {
			return { textbundle: m[1], asset: m[2] };
		} else {
			return null;
		}
	}

	function decodeTBText(path) {
		var m = path.match(/^(.*)\.tbtext$/);
		if(m) {
			return m[1];
		} else {
			return null;
		}
	}

	var oldParse = util.Permalink.prototype.parse;
	util.Permalink.prototype.parse = function(path) {
		path = path.replace(/\.textbundle\/text\.[a-z]+$/, "");
		return oldParse.call(this, path);
	};

	var oldReaddir = fs.readdir;
	fs.readdir = function(path) {
		var sourcePrefix = hexo.base_dir + hexo.config.source_dir;
		if(path.substr(0, sourcePrefix.length) !== sourcePrefix) {
			return oldReaddir.apply(this, arguments);
		}

		if(path.match(/\.textbundle$/)) {
			return oldReaddir(path).then(function(entries) {
				return entries
					.filter(function(x) { return x.match(/^text\./); })
					.map(function(x) { return x + ".tbtext"; });
			});
		}
		return oldReaddir.apply(this, arguments).then(function(entries) {
			return entries;
		});
	};

	function splitTextbundleFile(path) {
		var prefix = hexo.base_dir + hexo.config.source_dir;
		if(path[0] !== '/') {
			path = prefix + "/" + path;
		}
		if(path.substr(0, prefix.length) !== prefix) {
			return null;
		}
		var m = path.match(/^(.*[^\/]\.textbundle)(?:\/([^\/]+))?$/);
		if(!m) {
			return null;
		}
		var result = { textbundle: m[1], localFile: m[2], localPath: m[1].substr(prefix.length + 1) };
		result.getTextPath = function() {
			return new Promise(function(resolve, reject) {
				oldReaddir(result.textbundle)
					.catch(reject)
					.then(function(entries) {
						var texts = entries.filter(function(x) { return x.match(/^text\./); });
						if(texts.length) {
							return resolve(texts[0]);
						} else {
							return reject("could not find text file into textbundle");
						}
					});
			});
		};
		return result;
	}

	function registerTextBundle(path) {
		var textbundleTextFile = splitTextbundleFile(path);
		var textbundle = textbundleTextFile.textbundle;
		return oldReaddir(textbundle + "/assets")
			.catch(function() {
				// we might not have an assets dir when there is no assets
				return [];
			})
			.then(function(entries) {
				var Asset = hexo.model('Asset');
				entries.forEach(function(entry) {
					var options = {
						_id: '-textbundle-dynamic-/' + hexo.config.source_dir + "/" + textbundleTextFile.localPath + "/" + entry,
						path: '-textbundle-dynamic-/' + hexo.config.source_dir + "/" + textbundleTextFile.localPath + "/" + entry,
						modified: true,
						renderable: hexo.render.isRenderable(entry)
					};
					Asset.save(options);
				});
		});
	}

	// we intercept various calls to pretend that .textpack files are just text files
	var oldCreateReadStream = fs.createReadStream;
	fs.createReadStream = function(path) {
		var tbText = decodeTBText(path);
		if(tbText) {
			return oldCreateReadStream(tbText);
		}
		var textpackAsset = splitTextpackAsset(path);
		if(!textpackAsset) {
			var textbundleAsset = splitTextbundleAsset(path);
			if(textbundleAsset) {
				return oldCreateReadStream(textbundleAsset.textbundle + "/assets/" + textbundleAsset.asset);
			}
			return oldCreateReadStream.apply(this, arguments);
		}
		var result = new stream.PassThrough();
		var textpack = new Textpack({ path: textpackAsset.textpack });
		textpack.open()
			.catch(function(err) {
				result.emit("error", err);
			})
			.then(function() {
				result.write(textpack.assets[textpackAsset.asset]);
				result.end();
			});
		return result;
	};

	var oldFsExists = fs.exists;
	fs.exists = function(path) {
		var tbText = decodeTBText(path);
		if(tbText) {
			return oldFsExists(tbText);
		}
		var textpackAsset = splitTextpackAsset(path);
		if(!textpackAsset) {
			var textbundleAsset = splitTextbundleAsset(path);
			if(textbundleAsset) {
				return oldFsExists(textbundleAsset.textbundle + "/assets/" + textbundleAsset.asset)
					.then(function(exist){
						return exist;
					});
			}
			return oldFsExists.apply(this, arguments);
		}
		return new Promise(function(resolve, reject) {
			var textpack = new Textpack({ path: textpackAsset.textpack });
			return textpack.open()
				.catch(function(err) {
					reject(err);
				})
				.then(function() {
					var exists = !!textpack.assets[textpackAsset.asset];
					resolve(exists);
				});
		});
	};

	var oldWriteFile = fs.writeFile;
	fs.writeFile = function(path, data, callback) {
		var tbText = decodeTBText(path);
		if(tbText) {
			return oldWriteFile(tbText, data, callback);
		}
		if(!path.match(/\.textpack$/)) {
			return oldWriteFile.apply(this, arguments);
		}
		var textpack = new Textpack({ path: path });
		return textpack.write(data);
	};

	var oldFsWatch = fs.watch;
	fs.watch = function(path, options) {
		var sourcePrefix = hexo.base_dir + hexo.config.source_dir;
		if(path.substr(0, sourcePrefix.length) !== sourcePrefix) {
			return oldFsWatch.apply(this, arguments);
		}
		options = options || {};

		return oldFsWatch(path, options).then(function(watcher) {
			var oldEmit = watcher._emit;
			watcher._emit = function(event, path) {
				var args = Array.prototype.slice.call(arguments);
				var textbundleFile = splitTextbundleFile(path);
				if(textbundleFile) {
					// we let only events to the text.ext file through
					if(textbundleFile.localFile && textbundleFile.localFile.match(/^text\.[a-z]+$/)) {
						args[1] += ".tbtext";
						// we want to make sure the file is in sync
						setTimeout(function() {
							return oldEmit.apply(this, args);
						}.bind(this), 1000);
					}
				} else {
					return oldEmit.apply(this, arguments);
				}
			};
			return watcher;
		});
	};

	var oldFsStat = fs.stat;
	fs.stat = function(file) {
		var tbText = decodeTBText(file);
		if(tbText) {
			return oldFsStat(tbText);
		}
		var textbundleTextFile = splitTextbundleFile(file);
		if(textbundleTextFile) {
			if(!textbundleTextFile.localFile) {
				return oldFsStat.apply(this, arguments);
			} else if(textbundleTextFile.localFile === 'info.json') {
				return oldFsStat.apply(this, arguments);
			} else if(!textbundleTextFile.localFile) {
				return textbundleTextFile.getTextPath()
					.then(function(textPath) {
						return oldFsStat(textPath);
					});
			}
		}

		var textpackAsset = splitTextpackAsset(file);
		if(!textpackAsset) {
			var textbundleAsset = splitTextbundleAsset(file);
			if(textbundleAsset) {
				return oldFsStat(textbundleAsset.textbundle + "/assets/" + textbundleAsset.asset);
			} else {
				return oldFsStat.apply(this, arguments);
			}
		}
		return new Promise(function(resolve, reject) {
			var textpack = new Textpack({ path: textpackAsset.textpack });
			return textpack.open()
				.catch(function(err) {
					reject(err);
				})
				.then(function() {
					return oldFsStat(textpackAsset.textpack);
				})
				.then(function(stat) {
					if(textpack.assets[textpackAsset.asset]) {
						stat.size = textpack.assets[textpackAsset.asset].length;
					} else {
						stat.size = 0;
					}
					return stat;
				});
		});
	};


	// when a .textpack file is opened, we automatically register all the files contained within
	// the .textpack, so that images will be rendered as if they were regular filesystem image
	function registerAsset(textpack, assetName) {
		return new Promise(function(resolve) {
			var Asset = hexo.model('Asset');
			var path = (textpack.options.path + '/' + assetName).substr(hexo.base_dir.length);
			var options = {
				_id: '-textpack-dynamic-/' + path,
				path: '-textpack-dynamic-/' + path.substr((hexo.config.source_dir + "/").length),
				modified: true,
				renderable: hexo.render.isRenderable(path)
			};
			Asset.save(options);
			return resolve();
		});
	}

	var oldStat = File.prototype.stat;
	File.prototype.stat = function() {
		var self = this;
		return oldStat.apply(this, arguments);
	};

	var oldReadFile = fs.readFile;
	fs.readFile = function(path, options) {
		var tbText = decodeTBText(path);
		if(tbText) {
			return oldReadFile(tbText, options);
		} else {
			return oldReadFile.apply(this, arguments);
		}
	};

	var oldRead = File.prototype.read;
	File.prototype.read = function() {
		var self = this;
		if(self.source.match(/\.textpack$/)) {
			return new Promise(function(resolve) {
				var textpack = new Textpack({ path: self.source });
				textpack.open()
					.then(function() {
						return Promise.all(Object.keys(textpack.assets).map(function(assetName) {
							return registerAsset(textpack, assetName);
						}));
					}).then(function() {
						resolve(textpack.text);
					});
			});
		} else if(self.source.match(/\.textbundle\/text\./)) {
			return oldRead.apply(this, arguments).then(function(contents) {
				return registerTextBundle(self.source).thenReturn(contents);
			});
		} else {
			return oldRead.apply(this, arguments);
		}
	};

	var oldWrite = File.prototype.write;
	File.prototype.write = function() {
		var self = this;
		var tbText = decodeTBText(self.source);
		if(tbText) {
			return Promise.reject("Cannot write .textbundle files");
		} else if(self.source.match(/\.textpack$/)) {
			return Promise.reject("Cannot write .textpack files");
		} else {
			return oldWrite.apply(this, arguments);
		}
	};

	setupHexoAdmin();
};

})();
