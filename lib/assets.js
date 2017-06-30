(function(){

"use strict";

var fs = require("hexo-fs");
var pathFn = require("path");

function copyAsset(hexo, prefix, name, buffer) {
	return new Promise(function(resolve) {
		var path = hexo.config.source_dir + prefix + name, 
			dirname = pathFn.dirname(path),
			basename = pathFn.basename(path);
		
		fs.mkdirs(dirname)
			.then(function() {
				fs.createWriteStream(path).write(buffer, resolve);
			});
	});
}

exports.copyAssets = function(hexo, prefix, assets) {
	return Promise.all(Object.keys(assets).map(function(name) {
		return copyAsset(hexo, prefix, name, assets[name]);
	}));
};

})();
