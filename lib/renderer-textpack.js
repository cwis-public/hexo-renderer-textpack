(function() {

"use strict";

var Textpack = require("./textpack.js"),
	pathFn = require("path"),
	crypto = require("crypto"),
	yfm = require("hexo-front-matter");

function getExtname(str) {
	if(typeof str !== 'string') { return ''; }
	var extname = pathFn.extname(str);
	return extname[0] === '.'? extname.slice(1): extname;
}

function sha1(s) {
	var sum = crypto.createHash('sha1');
	sum.update(s);
	return sum.digest('hex');
}

exports.get = function(hexo) {
	return function(data, renderOptions) {
		var hexo = this;
		return new Promise(function(resolve, reject) {
			var textpack = new Textpack({ path: data.path });
			return textpack.open().then(function() {
				data.text = data.text || textpack.text;
				data.engine = getExtname(textpack.textName);
				return resolve();
			});
		}).then(function() {
			var assetsLibrary = {};
			data.text.split(/\r|\n/).forEach(function(line) {
				var m = line.match(/^\[([^\]]+)\]:\s*(.*)$/);
				if(m) {
					assetsLibrary[m[1]] = m[2];
				}
			});
			//var prefix = hexo.config.root + 'textpack/' + sha1(data.path) + '/';
			var prefix = '/-textpack-dynamic-/' + data.path.substr((hexo.base_dir + '/' + hexo.config.source_dir).length) + "/";
			data.text = yfm(data.text
					.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(match, p1, p2) { return "![" + p1 + "](" + prefix + p2 + ")"; })
					.replace(/!\[([^\]]*)\]\[([^\]]+)\]/g, function(match, p1, p2) { return "![" + p1 + "](" + prefix + assetsLibrary[p2] + ")"; })
				)._content;

			return hexo.render.render(data);
		});
	};
};

})();
