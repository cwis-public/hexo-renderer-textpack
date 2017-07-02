(function() {

"use strict";

var Textpack = require("./textpack"),
	File = require("hexo/lib/box/file.js"),
	nodeFs = require("fs"),
	fs = nodeFs.existsSync("../../hexo/node_modules/hexo-fs")? require("../../hexo/node_modules/hexo-fs"): require("hexo-fs"),
	stream = require("stream");

function setupHexoAdmin() {
	// hexo-admin has an editor that allows for overwritting of .textpack files very
	// easily, we prevent that by hooking on their hexo-fs API 
	var hexoAdminFs;
	setupHexoAdmin.ntry = (setupHexoAdmin.ntry || 0) + 1;
	if(!nodeFs.existsSync("../../hexo-admin/node_mobules/hexo-fs")) {
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
	var sourceDirTextpackDynamic = hexo.base_dir + '__textpack-dynamic__/' + hexo.config.source_dir + '/';
	function splitTextpackAsset(path) {
		if(!path.match(/__textpack-dynamic__/)) {
			return null;
		}
		if(!path.match(sourceDirTextpackDynamic)) {
			return null;
		}
		path = path.replace("__textpack-dynamic__/", "");
		var m = path.match(/^(.*\.textpack)\/(.*)$/);
		if(m) {
			return { textpack: m[1], asset: m[2] };
		} else {
			return null;
		}
	}

	// we intercept various calls to pretend that .textpack files are just text files
	var oldCreateReadStream = fs.createReadStream;
	fs.createReadStream = function(path) {
		var textpackAsset = splitTextpackAsset(path);
		if(!textpackAsset) {
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
		var textpackAsset = splitTextpackAsset(path);
		if(!textpackAsset) {
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
		if(!path.match(/\.textpack$/)) {
			return oldWriteFile.apply(this, arguments);
		}
		var textpack = new Textpack({ path: path });
		return textpack.write(data);
	};

	var oldFsStat = fs.stat;
	fs.stat = function(file) {
		var textpackAsset = splitTextpackAsset(file);
		if(!textpackAsset) {
			return oldFsStat.apply(this, arguments);
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
				_id: '__textpack-dynamic__/' + path,
				path: '__textpack-dynamic__/' + path.substr((hexo.config.source_dir + "/").length),
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

	setupHexoAdmin();
};

})();
