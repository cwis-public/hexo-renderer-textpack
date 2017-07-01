/* global hexo */

"use strict;";

var renderer = require("./lib/renderer.js").get(hexo),
	file = require("./lib/file.js");

file.initialize(hexo);

hexo.extend.renderer.register('textpack', 'html', renderer, true);
