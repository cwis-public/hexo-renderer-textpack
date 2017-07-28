(function() {

"use strict";

var pathFn = require("path"),
	fs = require("hexo-fs");

exports.get = function(hexo) {
	return function(data, renderOptions) {
		data.path = data.path.replace(/\.tbtext$/, "");

		return fs.readFile(data.path)
			.then(function(text) {
				var contents = data.text;
				var assetsLibrary = {};
				contents.split(/\r|\n/).forEach(function(line) {
					var m = line.match(/^\[([^\]]+)\]:\s*(.*)$/);
					if(m) {
						assetsLibrary[m[1]] = m[2].replace(/^assets\//, "");
					}
				});
				//var prefix = hexo.config.root + 'textpack/' + sha1(data.path) + '/';
				var localPath = data.path.substr((hexo.base_dir + "/" + hexo.config.source_dir).length).replace(/\/text\.[a-z]+/, "");
				var prefix = '/-textbundle-dynamic-/' + hexo.config.source_dir + "/" + localPath + "/";
				contents = contents
						.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(match, p1, p2) { return "![" + p1 + "](" + prefix + p2 + ")"; })
						.replace(/!\[([^\]]*)\]\[([^\]]+)\]/g, function(match, p1, p2) { return "![" + p1 + "](" + prefix + assetsLibrary[p2] + ")"; });

				data.text = contents;
				return hexo.render.render(data);
			});
	};
};

})();
