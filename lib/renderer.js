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
	return function(data, options) {
		var textpack = new Textpack({ path: data.path });
		return textpack.open().then(function() {

			var options = {
				text: textpack.text,
				engine: getExtname(textpack.textName)
			};

			//var prefix = hexo.config.root + 'textpack/' + sha1(data.path) + '/';
			var prefix = '/__textpack-dynamic__/' + data.path.substr((hexo.base_dir + '/' + hexo.config.source_dir).length) + "/";
			options.text = yfm(options.text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(match, p1, p2) { return "![" + p1 + "](" + prefix + p2 + ")" }))._content;
			return hexo.render.render(options);
		});
	};
};

})();
